// 上山捡菌 / Mushroom Picking — browser client.
// Help & Explain follow designs/task40.md via the shared widgets.
// Rules, online rulings and AI notes: designs/task193.md

const mpickPanel = document.getElementById("mushroomPickingPanel");
const mpickHeader = document.getElementById("mushroomPickingHeaderActions");
const mpickHelpButton = document.getElementById("mushroomPickingHelpBtn");
const mpickExplainButton = document.getElementById("mushroomPickingExplainBtn");

const MPICK_HELP_CONFIG = {
  gameId: "mushroom_picking",
  title: { zh: "上山捡菌", en: "Mushroom Picking" },
  basic: {
    win: {
      zh: "菌窝(🍄)的牌全部抽完之后结算，分数最高的人获胜。玩法一比的是面前得分区的总分，玩法二比的是完成订单(📜)拿到的总分。",
      en: "Once the nest (🍄) is empty everybody scores and the highest total wins. Basic mode counts the cards in your score area, while Orders mode counts the orders (📜) you completed."
    },
    turn: {
      zh: "轮到你时三选一，从菌窝(🍄)摸三张留两张并把剩下一张放进公共牌区、从公共牌区拿走一张、或者打出手牌。",
      en: "On your turn pick exactly one of three things. Draw three from the nest (🍄) and keep two while the third goes to the public row, take one card out of that public row, or play cards from your hand."
    },
    key: {
      zh: "重点是把同一种菌凑够三张、把需要搭档的牌配成一对再一次性打出，因为一次打出的组合越整齐，分数涨得越快。",
      en: "The key is gathering three of a kind and pairing the cards that need a partner, then playing them all at once, because the tidier a single play is the faster the score climbs."
    }
  },
  sections: [
    {
      id: "setup",
      label: { zh: "开局", en: "Setup" },
      html: {
        zh: "<p>玩法一一共 62 张菌类牌，洗匀之后叠成菌窝(🍄)，公共牌区开局为空，每人手牌为空。</p>"
          + "<p>玩法二把菌窝换成 54 张，去掉火力(🔥)、野猪(🐗)和干草(🌾)，再加入 20 张订单牌。开局时每人面前明置两张订单牌(📜)，桌面中央再明置两张订单牌供大家挑选。</p>"
          + "<p>线上版从 1 号座位开始，之后按座位顺时针轮流。</p>",
        en: "<p>Basic mode uses 62 mushroom cards. Shuffle them into the nest (🍄), start with an empty public row, and everybody starts with an empty hand.</p>"
          + "<p>Orders mode swaps the nest for 54 cards by dropping Campfire (🔥), Wild Boar (🐗) and Dry Grass (🌾), then adds 20 order cards. Every player starts with two face up orders (📜) in front of them and two more sit face up in the middle for anyone to take.</p>"
          + "<p>The online build starts with seat 1 and then passes clockwise.</p>"
      }
    },
    {
      id: "turn",
      label: { zh: "回合行动", en: "Your turn" },
      html: {
        zh: "<p><strong>摸三留二：</strong>点菌窝(🍄)会亮出三张牌，只有你看得到它们，然后挑两张收进手牌，剩下那张自动进入公共牌区。菌窝不足三张时抽到什么就全收下，不用弃牌。</p>"
          + "<p><strong>拿一张：</strong>点公共牌区里的任意一张牌，牌上会盖一层蒙版，在蒙版里按 Take 才真的拿走，按 Cancel 或点面板空白处取消。</p>"
          + "<p><strong>打出手牌：</strong>点手牌可以多选，选好之后下方会出现操作条，在操作条里确认才会打出。玩法二要先点一张自己面前的订单牌(📜)，再点手牌凑齐它的需求。</p>"
          + "<p>行动做完立刻换下一位玩家。菌窝被抽空之后，从抽走最后一张牌的那位玩家的下一位开始，所有人再各进行一个回合，然后进入结算。</p>",
        en: "<p><strong>Draw three keep two:</strong> tapping the nest (🍄) reveals three cards that only you can see. Keep two of them and the third goes to the public row. When fewer than three cards remain you simply keep everything you drew.</p>"
          + "<p><strong>Take one:</strong> tap any card in the public row and a layer covers it. Press Take inside that layer to really take it, or press Cancel or tap empty space to back out.</p>"
          + "<p><strong>Play cards:</strong> tap cards in your hand to select several of them, and an action bar appears underneath. Only confirming in that bar plays them. In Orders mode you first tap one of your own orders (📜) and then pick the hand cards that fill it.</p>"
          + "<p>Your turn ends the moment the action is done. Once the nest is empty, play continues for exactly one more turn each starting from the player after whoever took the last card, and then the game scores.</p>"
      }
    },
    {
      id: "score",
      label: { zh: "玩法一计分", en: "Basic scoring" },
      html: {
        zh: "<p>一次打出的分数按下面的顺序算完，然后整叠放进你的得分区。</p>"
          + "<p><strong>单卡分值：</strong>青头菌(🍄)与喇叭菌(🍄)各 2 分，毛头鬼伞(🍄) 3 分，羊肚菌(🍄)与竹荪菌(🍄)各 3 分，牛肝菌(🍄) 3 分，松茸菌(🍄)与干巴菌(🍄)各 4 分，松露菌(🍄) 12 分。</p>"
          + "<p><strong>同类三张：</strong>青头菌或喇叭菌一次打出三张或更多时，那一组的牌面总分翻倍。</p>"
          + "<p><strong>羊肚菌配竹荪菌：</strong>两种同时打出额外加 8 分。</p>"
          + "<p><strong>大蒜(🧄)：</strong>必须和至少一张野生菌一起打出，本次野生菌的小计翻倍，一次打出里放几头大蒜都只翻一倍。</p>"
          + "<p><strong>见手青(🍄)与火力(🔥)：</strong>见手青单独打出记 0 分，和火力一起打出才拿到 10 分。游戏结束时每张留在手里的见手青扣 10 分。</p>"
          + "<p><strong>松露菌与野猪(🐗)：</strong>松露菌只有和野猪在同一次打出里才拿到 12 分，单独打出记 0 分。</p>"
          + "<p><strong>毛头鬼伞：</strong>打出时二选一，要么正常拿 3 分，要么把这张记 0 分并清空公共牌区。</p>"
          + "<p><strong>干草(🌾)：</strong>清空公共牌区所有牌，清空的牌和干草自己都进弃牌堆。</p>"
          + "<p><strong>野猪单独打出：</strong>随机撞飞其它每一位玩家手中一半的手牌，向上取整，撞飞的牌和野猪一起进弃牌堆。</p>",
        en: "<p>One play is scored in the order below and then the whole stack moves into your score area.</p>"
          + "<p><strong>Face values:</strong> Russula (🍄) and Trumpet Chanterelle (🍄) are 2 each, Shaggy Mane (🍄) 3, Morel (🍄) and Bamboo Fungus (🍄) 3 each, Porcini (🍄) 3, Matsutake (🍄) and Ganba Fungus (🍄) 4 each, and Truffle (🍄) 12.</p>"
          + "<p><strong>Three of a kind:</strong> playing three or more Russula or Trumpet Chanterelle together doubles that group's face total.</p>"
          + "<p><strong>Morel with Bamboo Fungus:</strong> playing both together adds 8 points.</p>"
          + "<p><strong>Garlic (🧄):</strong> it has to be played with at least one wild mushroom and doubles their subtotal. Several bulbs in one play still only double once.</p>"
          + "<p><strong>Blueing Bolete (🍄) and Campfire (🔥):</strong> the bolete scores nothing on its own and only reaches 10 points alongside a campfire. Every copy left in hand at the end costs 10 points.</p>"
          + "<p><strong>Truffle and Wild Boar (🐗):</strong> a truffle only reaches 12 points when a boar is in the same play, and scores 0 on its own.</p>"
          + "<p><strong>Shaggy Mane:</strong> choose one when you play it, either take the 3 points or score 0 for it and wipe the public row.</p>"
          + "<p><strong>Dry Grass (🌾):</strong> wipes every card out of the public row, and both those cards and the grass itself go to the discard.</p>"
          + "<p><strong>Wild Boar alone:</strong> it knocks away half of every other hand, rounded up, and the scattered cards plus the boar go to the discard.</p>"
      }
    },
    {
      id: "orders",
      label: { zh: "玩法二订单", en: "Orders mode" },
      html: {
        zh: "<p>玩法二把打牌得分换成打牌完成订单(📜)。订单牌上的需求分两类，指定星级比如一星菌(★)两张，或者指定某一种菌。每张打出的牌只能填一个需求位，凑齐全部需求位才算完成。</p>"
          + "<p>完成时打出的菌类牌进弃牌堆，订单牌本身进入你的得分区并立刻拿到它的分数。完成之后从中央两张订单里二选一接到自己面前，中央再补翻一张。</p>"
          + "<p><strong>星级：</strong>一星(★)是青头菌、喇叭菌、毛头鬼伞和大蒜，二星(★★)是羊肚菌、竹荪菌、牛肝菌和见手青，三星(★★★)是松露菌、松茸菌和干巴菌。</p>"
          + "<p><strong>带辣味(🔥)标记的订单：</strong>阿婆馆、云味记和炒饭仙人。后厨堂让每一张已完成的辣味订单额外加 2 分，这一条在终局结算。</p>"
          + "<p><strong>终局加成：</strong>菜市场按剩余每张手牌加 1 分，锦绣斋按手里每张三星菌加 3 分，百珍楼按每张已完成订单加 2 分。留在手里的见手青依旧每张扣 10 分。</p>"
          + "<p><strong>订单技能：</strong>山货铺完成后从公共牌区拿 1 张，截货肆完成后随机抽走对手 1 张手牌，甩碗店完成后立刻多拿 1 张新订单，云味记完成后可以从公共牌区取 2 张，松茸阁完成后立刻多进行一个回合，映月居在它还没完成时每回合可以免费用 1 张手牌换公共区 1 张牌，菜市场不需要打出任何牌就能完成。</p>",
        en: "<p>Orders mode replaces scoring cards with filling orders (📜). Every requirement is either a star level such as two one-star mushrooms (★), or one named mushroom, and each card you play fills exactly one slot, so an order is only done when every slot is covered.</p>"
          + "<p>Completing one sends the mushrooms you played to the discard, moves the order card itself into your score area and pays its points at once. You then pick one of the two centre orders to take, and a fresh one is flipped to refill the middle.</p>"
          + "<p><strong>Star levels:</strong> one star (★) covers Russula, Trumpet Chanterelle, Shaggy Mane and Garlic. Two stars (★★) cover Morel, Bamboo Fungus, Porcini and Blueing Bolete. Three stars (★★★) cover Truffle, Matsutake and Ganba Fungus.</p>"
          + "<p><strong>Spicy (🔥) orders:</strong> Granny's House, Yun Flavours and the Fried Rice Sage. The Back Kitchen makes every completed spicy order worth 2 extra points, counted at the end.</p>"
          + "<p><strong>End of game bonuses:</strong> the Wet Market pays 1 per card left in hand, the Brocade Hall pays 3 per three-star mushroom in hand, and the Hundred Delicacies pays 2 per order you completed. A Blueing Bolete left in hand still costs 10 points.</p>"
          + "<p><strong>Order skills:</strong> the Mountain Goods Stall takes 1 card from the public row, the Cargo Snatchers steal 1 random card from an opponent, the Bowl Smashers hand you an extra order at once, Yun Flavours lets you take 2 cards from the public row, the Matsutake Pavilion grants an immediate extra turn, the Moonlit Pavilion lets you swap 1 hand card for 1 public card free every turn while it is still open, and the Wet Market is completed without playing any card at all.</p>"
      }
    },
    {
      id: "online",
      label: { zh: "线上操作", en: "Playing online" },
      html: {
        zh: "<p>轮到你时，可以点的目标会亮起来。点菌窝(🍄)直接摸牌，点公共牌区的牌会盖上蒙版确认，点手牌是多选，下方的操作条会写出这一手预计能拿多少分。</p>"
          + "<p>操作条里会提示不合法的组合，比如大蒜没有配野生菌、火力没有配见手青、野猪混在别的牌里。</p>"
          + "<p>点面板空白处或按 Esc 都能取消当前选择。</p>"
          + "<p>你只看得到自己的手牌，别人只显示张数，摸牌亮出的三张也只有你自己看得到。结算阶段会公开所有人的手牌和分数明细，所有人按 Continue 才进入最终结果。</p>"
          + "<p>按 Explain 之后再点任意控件可以查看它的说明，Explain 模式下不会执行任何游戏操作，再按一次 Explain 或按 Esc 退出。</p>",
        en: "<p>On your turn every legal target lights up. Tapping the nest (🍄) draws straight away, tapping a public card lays a confirm layer over the row, and tapping hand cards selects several at a time while the action bar underneath spells out what the play would score.</p>"
          + "<p>The action bar also explains illegal combinations, such as garlic without a wild mushroom, a campfire without a bolete, or a boar mixed in with other cards.</p>"
          + "<p>Tapping empty space or pressing Esc drops the current selection.</p>"
          + "<p>You only ever see your own hand, other hands show a count, and the three cards you reveal while drawing are yours alone. The settlement reveals every hand and the full score breakdown, and everybody presses Continue before the final result appears.</p>"
          + "<p>Press Explain and then any control to read its description. Explain never performs a game action, and a second press or Esc leaves the mode.</p>"
      }
    }
  ]
};

const MPICK_EXPLAIN = {
  mode: {
    zh: "当前玩法。玩法一是打牌得分的成套收集，玩法二改成打牌完成订单(📜)。",
    en: "The mode in play. Basic scores the cards you play, while Orders turns the same cards into completed orders (📜)."
  },
  turn: {
    zh: "轮到谁。只有轮到你时，菌窝(🍄)、公共牌区和手牌才会响应点击。",
    en: "Whose turn it is. The nest (🍄), the public row and your hand only respond on your own turn."
  },
  pass: {
    zh: "跳过回合。只有在菌窝已空、公共牌区为空、手牌也打不出任何合法组合时才会出现。",
    en: "Skip your turn. It only appears when the nest is empty, the public row is empty and your hand has no legal play left."
  },
  banner: {
    zh: "当前提示。轮到谁、正在挑牌还是正在接订单、结算暂停和最终胜负都写在这里。",
    en: "The live message. It says whose turn it is, whether somebody is picking cards or taking an order, and it hosts the settlement pause plus the final result."
  },
  nest: {
    zh: "菌窝(🍄)，也就是牌堆。轮到你时点它会摸三张牌，然后你挑两张留下，剩下一张进公共牌区。牌堆被抽空之后每人还剩最后一个回合。",
    en: "The nest (🍄) is the draw pile. Tapping it on your turn draws three cards, you keep two, and the third goes to the public row. Once it runs out everybody gets exactly one more turn."
  },
  public: {
    zh: "公共牌区。别人摸牌时弃掉的那一张会落在这里，任何人都可以用一个回合从这里拿走一张。干草(🌾)、毛头鬼伞的清空选项和野猪(🐗)都会动到这一区。",
    en: "The public row. The card somebody discards while drawing lands here, and anyone can spend a turn taking one card out of it. Dry Grass (🌾), the Shaggy Mane wipe and the Wild Boar (🐗) all act on this row."
  },
  public_card: {
    zh: "公共牌区里的一张牌。点它会盖上蒙版，在蒙版里确认才会真的拿走。",
    en: "One card in the public row. Tapping it lays a layer over the row, and only confirming inside that layer really takes it."
  },
  orders: {
    zh: "中央订单区。完成订单后从这两张里二选一接到自己面前，然后中央会补翻一张，凑够订单牌堆用完为止。",
    en: "The centre orders. After completing an order you take one of these two, and a fresh one is flipped to refill the middle until the order deck runs out."
  },
  order_pick: {
    zh: "一张可以接下的中央订单。点它会盖上蒙版，在蒙版里确认才会接下。",
    en: "A centre order you can take. Tapping it lays a layer over the row, and only confirming inside that layer takes it."
  },
  players: {
    zh: "每位玩家一行。左边是名字和分数，中间是得分区里的菌类统计或者已完成的订单，右边是手牌张数。当前行动的玩家会高亮。",
    en: "One row per player. The name and score sit on the left, the middle shows either the mushrooms in their score area or the orders they finished, and the right shows a hand count. The player who is acting is highlighted."
  },
  player_row: {
    zh: "一位玩家的状态。分数是已经结算进得分区的部分，手牌张数对所有人可见但牌面只有本人看得到。",
    en: "One player's status. The score is what has already been banked, and while the hand count is public the faces are only visible to their owner."
  },
  scored: {
    zh: "得分区里已经打出的菌类，按种类合并显示。这一区的分数在终局时加上手里的见手青惩罚就是最终得分。",
    en: "The mushrooms already played into this score area, merged by kind. Its total plus the Blueing Bolete penalty from the hand is the final score."
  },
  hand: {
    zh: "你的手牌。点牌可以多选，选好之后下方的操作条会算出这一手能拿多少分，确认才会打出。别人只看得到你的手牌张数。",
    en: "Your hand. Tap cards to select several, and the action bar underneath works out what the play would score before you confirm. Other players only see how many cards you hold."
  },
  hand_card: {
    zh: "一张手牌。点它会选中或取消选中，被选中的牌会加上高亮边框。",
    en: "One card in your hand. Tapping selects or deselects it, and a selected card gets a highlighted border."
  },
  keep: {
    zh: "摸牌亮出的三张牌，只有你看得到。挑两张收进手牌，剩下那张会自动放进公共牌区。菌窝不足三张时只能全部收下。",
    en: "The three cards you just drew, which only you can see. Keep two and the third goes to the public row by itself. When the nest held fewer than three you keep everything."
  },
  my_orders: {
    zh: "你面前的订单(📜)。点一张把它设成当前目标，然后点手牌凑齐它的需求位。带辣味(🔥)标记的订单会被后厨堂额外加分。",
    en: "The orders (📜) in front of you. Tap one to make it the current target, then pick hand cards to cover its slots. Spicy (🔥) orders pay extra once you own the Back Kitchen."
  },
  done_orders: {
    zh: "已经完成的订单(📜)。它们的分数在完成时就已经计入，百珍楼还会按这里的张数在终局再加一次分。",
    en: "The orders (📜) you already completed. Their points were banked on completion, and the Hundred Delicacies counts them again at the end."
  },
  swap: {
    zh: "映月居的免费换牌。只要映月居还没完成，每回合可以用一张手牌换走公共牌区的一张牌，而且不占用你这个回合的行动。",
    en: "The Moonlit Pavilion free swap. While that order is still open you may trade one hand card for one public card each turn without spending your action."
  },
  playbar: {
    zh: "操作条。这里会写出当前选择的合法性、预计得分，以及确认和取消两个按钮。点面板空白处或按 Esc 也能取消。",
    en: "The action bar. It reports whether the current selection is legal, what it would score, and offers confirm and cancel. Tapping empty space or pressing Esc also cancels."
  },
  settle: {
    zh: "终局结算。这里公开所有人的手牌，并逐条列出每个人的分数构成。所有人按 Continue 之后才会显示最终胜负。",
    en: "The final settlement. It reveals every hand and lists each player's score line by line. Everybody presses Continue before the result appears."
  },
  continue: {
    zh: "结算暂停。所有人按下 Continue 才会从结算进入最终结果。",
    en: "The settlement pause. Play only moves from the settlement to the result once everybody has pressed Continue."
  },
  again: {
    zh: "再来一局。所有人按下 Play again 之后，会用同样的座位和玩法重新洗牌开局。",
    en: "Play again. Once everybody presses it, the same seats and mode are reshuffled into a fresh game."
  },
  log: {
    zh: "行动日志，记录发牌、每一次摸牌与弃牌、每一次打出与得分，以及订单的完成和技能。",
    en: "The action log, listing the deal, every draw and discard, every play with its score, and each order completion with its skill."
  }
};

// Corner badge per card. Points where the card has them, otherwise the shortest
// possible hint at what the card does.
const MPICK_BADGE = {
  qingtou: "2", laba: "2", maotou: "3", dasuan: "×2",
  yangdu: "3", zhusun: "3", niugan: "3", jianshou: "10",
  songrong: "4", ganba: "4", songlu: "12",
  huoli: "+10", gancao: "清空", yezhu: "撞飞"
};

const MPICK_WILD = ["qingtou", "laba", "maotou", "yangdu", "zhusun", "niugan",
  "jianshou", "songrong", "ganba", "songlu"];
const MPICK_POINTS = {
  qingtou: 2, laba: 2, maotou: 3, dasuan: 0, yangdu: 3, zhusun: 3, niugan: 3,
  jianshou: 10, songrong: 4, ganba: 4, songlu: 12, huoli: 0, gancao: 0, yezhu: 0
};

let mpickView = null;
let mpickHelpWidget = null;
let mpickExplainWidget = null;
let mpickSel = [];
let mpickOrder = null;
let mpickTake = null;
let mpickKeep = [];
let mpickSwap = null;
let mpickPending = false;
let mpickPendingTimer = null;
let mpickSignature = null;
let mpickExplainPress = false;

const mpickEsc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
));

/* --- lookups ---------------------------------------------------------- */

function mpickPlayer(id) {
  return mpickView?.players.find((player) => player.player_id === id) || null;
}

function mpickName(id) {
  return mpickPlayer(id)?.name || "—";
}

function mpickMe() {
  return mpickPlayer(mpickView?.you);
}

function mpickLegal(action) {
  return !mpickPending && !!mpickView?.legal_actions?.includes(action);
}

function mpickMyTurn() {
  return mpickView?.stage === "play" && mpickView.current_player === mpickView.you;
}

function mpickCardById(id) {
  const me = mpickMe();
  const pools = [me?.hand || [], mpickView?.public || [], mpickView?.pending_draw || []];
  for (const pool of pools) {
    const found = pool.find((card) => card.id === id);
    if (found) return found;
  }
  return null;
}

function mpickTargetOrder() {
  const me = mpickMe();
  if (!me || !mpickOrder) return null;
  return me.orders.find((order) => order.id === mpickOrder) || null;
}

// Per card and per order explanations are learnt from whatever the server has
// shown us, so the text always matches the shipped card data.
function mpickLearnExplanations() {
  if (!mpickView) return;
  const add = (prefix, item, zh, en) => {
    const key = prefix + "_" + item.key;
    if (MPICK_EXPLAIN[key]) return;
    MPICK_EXPLAIN[key] = { zh, en };
  };
  const learnCard = (card) => add(
    "card", card,
    card.emoji + " " + card.zh + "（" + (card.star ? "★".repeat(card.star) : "无星级")
      + "，牌面 " + (card.points || 0) + " 分）：" + card.text_zh,
    card.emoji + " " + card.en + " (" + (card.star ? "★".repeat(card.star) : "no star")
      + ", face value " + (card.points || 0) + "): " + card.text_en
  );
  const learnOrder = (order) => add(
    "order", order,
    order.emoji + " " + order.zh + (order.spicy ? "（辣味 🔥）" : "")
      + "，完成得 " + order.points + " 分，需求 " + mpickSlotsText(order) + "。" + order.text_zh,
    order.emoji + " " + order.en + (order.spicy ? " (spicy 🔥)" : "")
      + ", worth " + order.points + " points, needs " + mpickSlotsText(order) + ". " + order.text_en
  );
  (mpickView.public || []).forEach(learnCard);
  (mpickView.pending_draw || []).forEach(learnCard);
  (mpickView.order_center || []).forEach(learnOrder);
  (mpickView.players || []).forEach((player) => {
    (player.hand || []).forEach(learnCard);
    (player.orders || []).forEach(learnOrder);
    (player.done_orders || []).forEach(learnOrder);
  });
}

/* --- rules mirror ------------------------------------------------------ */
// The server is authoritative. This mirror only drives the hint and the
// projected score in the action bar, and follows designs/task193.md §6.1.

function mpickSlotGroups(order) {
  const groups = [];
  (order.slots || []).forEach((slot) => {
    const label = slot.zh || (slot.card ? slot.card : "★".repeat(slot.star) + "菌");
    const hit = groups.find((group) => group.label === label);
    if (hit) hit.count += 1;
    else groups.push({ label, count: 1, card: slot.card || null, star: slot.star || 0 });
  });
  return groups;
}

function mpickSlotsText(order) {
  const groups = mpickSlotGroups(order);
  if (!groups.length) return "无";
  return groups.map((group) => group.label + "×" + group.count).join(" + ");
}

function mpickPlayProblem(cards) {
  if (!cards.length) return null;
  const keys = cards.map((card) => card.key);
  const has = (key) => keys.includes(key);
  if (has("dasuan") && !keys.some((key) => MPICK_WILD.includes(key))) {
    return "大蒜要配至少一张野生菌";
  }
  if (has("huoli") && !has("jianshou")) return "火力要配见手青";
  if (has("yezhu") && !has("songlu") && cards.length > 1) {
    return "野猪只能单独打出，或者配松露菌";
  }
  return null;
}

function mpickPlayScore(cards, choice) {
  const counts = {};
  cards.forEach((card) => { counts[card.key] = (counts[card.key] || 0) + 1; });
  const has = (key) => (counts[key] || 0) > 0;
  let base = 0;
  Object.keys(counts).forEach((key) => {
    const count = counts[key];
    if (key === "jianshou") base += has("huoli") ? 10 * count : 0;
    else if (key === "songlu") base += has("yezhu") ? 12 * count : 0;
    else if (key === "maotou") base += choice === "clear" ? 0 : 3 * count;
    else base += (MPICK_POINTS[key] || 0) * count;
  });
  let extra = 0;
  ["qingtou", "laba"].forEach((key) => {
    const count = counts[key] || 0;
    if (count >= 3) extra += 2 * count;
  });
  if (has("yangdu") && has("zhusun")) extra += 8;
  let total = base + extra;
  if (has("dasuan") && keys_some_wild(counts)) total *= 2;
  return total;
}

function keys_some_wild(counts) {
  return MPICK_WILD.some((key) => (counts[key] || 0) > 0);
}

function mpickSelectedCards() {
  return mpickSel.map((id) => mpickCardById(id)).filter(Boolean);
}

function mpickFillsOrder(order, cards) {
  const slots = (order.slots || []).slice();
  if (slots.length !== cards.length) return false;
  const pool = cards.slice();
  const specific = slots.filter((slot) => slot.card);
  const generic = slots.filter((slot) => !slot.card);
  for (const slot of specific) {
    const index = pool.findIndex((card) => card.key === slot.card);
    if (index < 0) return false;
    pool.splice(index, 1);
  }
  for (const slot of generic) {
    const index = pool.findIndex((card) => card.star === slot.star);
    if (index < 0) return false;
    pool.splice(index, 1);
  }
  return true;
}

/* --- markup ----------------------------------------------------------- */

function mpickCardHTML(card, opts = {}) {
  const classes = ["mushroom-card", "is-" + card.kind];
  if (opts.selected) classes.push("is-selected");
  if (opts.picked) classes.push("is-picked");
  if (opts.open) classes.push("is-open");
  if (opts.dim) classes.push("is-dim");
  const stars = card.star ? "★".repeat(card.star) : "";
  const badge = MPICK_BADGE[card.key] || (card.points ? String(card.points) : "");
  const attrs = ['data-mpick-explain="card_' + mpickEsc(card.key) + '"'];
  if (opts.pick) attrs.push('data-mpick-pick="' + mpickEsc(opts.pick) + '"');
  if (opts.index !== undefined) attrs.push('data-mpick-index="' + opts.index + '"');
  return '<div class="' + classes.join(" ") + '" ' + attrs.join(" ") + ">"
    + '<span class="mushroom-card-badge">' + mpickEsc(badge) + "</span>"
    + '<span class="mushroom-card-emoji">' + card.emoji + "</span>"
    + '<span class="mushroom-card-name">' + mpickEsc(card.zh) + "</span>"
    + (stars ? '<span class="mushroom-card-stars">' + stars + "</span>" : "")
    + "</div>";
}

function mpickOrderHTML(order, opts = {}) {
  const classes = ["mushroom-order"];
  if (order.spicy) classes.push("is-spicy");
  if (opts.target) classes.push("is-target");
  if (opts.ready) classes.push("is-ready");
  if (opts.picked) classes.push("is-picked");
  if (opts.open) classes.push("is-open");
  if (opts.mini) classes.push("is-mini");
  const attrs = ['data-mpick-explain="order_' + mpickEsc(order.key) + '"'];
  if (opts.pick) attrs.push('data-mpick-order="' + mpickEsc(opts.pick) + '"');
  if (opts.centre) attrs.push('data-mpick-centre="' + mpickEsc(opts.centre) + '"');
  const groups = mpickSlotGroups(order);
  const slots = groups.length
    ? groups.map((group) => '<span class="mushroom-slot">'
        + mpickEsc(group.label) + (group.count > 1 ? "×" + group.count : "") + "</span>").join("")
    : '<span class="mushroom-slot is-free">无需打牌</span>';
  return '<div class="' + classes.join(" ") + '" ' + attrs.join(" ") + ">"
    + '<span class="mushroom-order-badge">' + order.points + "</span>"
    + '<span class="mushroom-order-emoji">' + order.emoji + "</span>"
    + '<span class="mushroom-order-name">' + mpickEsc(order.zh)
    + (order.spicy ? '<span class="mushroom-order-spicy">🔥</span>' : "") + "</span>"
    + '<span class="mushroom-order-slots">' + slots + "</span>"
    + (opts.mini ? "" : '<span class="mushroom-order-text">' + mpickEsc(order.text_zh) + "</span>")
    + "</div>";
}

function mpickMaskHTML(label, action, extra = "") {
  return '<div class="mushroom-mask' + (extra ? " " + extra : "") + '">'
    + '<button type="button" class="mushroom-go" data-mpick-go="' + mpickEsc(action) + '">'
    + mpickEsc(label) + "</button>"
    + '<button type="button" data-mpick-cancel="1">Cancel</button>'
    + "</div>";
}

function mpickBarHTML(inner, explain) {
  return '<div class="mushroom-bar" data-mpick-explain="' + explain + '">' + inner + "</div>";
}

function mpickGoButton(label, action, disabled) {
  return '<button type="button" class="mushroom-go" data-mpick-go="' + mpickEsc(action) + '"'
    + (disabled ? " disabled" : "") + ">" + mpickEsc(label) + "</button>";
}

function mpickCancelButton() {
  return '<button type="button" data-mpick-cancel="1">Cancel</button>';
}

/* --- renderers --------------------------------------------------------- */

function mpickBannerHTML() {
  const view = mpickView;
  if (view.game_over) {
    const winners = view.winners || [];
    const mine = winners.includes(view.you);
    const head = !winners.length
      ? "本局结束"
      : (mine ? "🏆 你赢下了这一局！" : "🏆 " + mpickEsc(winners.map(mpickName).join("、")) + " 获胜");
    const ready = (view.rematch_ready || []).includes(view.you);
    return {
      cls: "is-shown " + (winners.length ? "is-good" : ""),
      html: head + '<div class="mushroom-banner-actions">'
        + '<button type="button" class="mushroom-go" data-mpick-again="1" data-mpick-explain="again"'
        + (ready ? " disabled" : "") + ">" + (ready ? "等待其他玩家" : "Play again") + "</button></div>"
    };
  }
  if (view.stage === "scoring") {
    const ready = (view.continue_ready || []).includes(view.you);
    return {
      cls: "is-shown",
      html: "菌窝见底，本局结束，所有人看一下结算。"
        + '<div class="mushroom-banner-actions">'
        + '<button type="button" class="mushroom-go" data-mpick-continue="1" data-mpick-explain="continue"'
        + (ready ? " disabled" : "") + ">" + (ready ? "等待其他玩家" : "Continue") + "</button></div>"
    };
  }
  const mine = view.current_player === view.you;
  if (view.phase === "keep") {
    const who = mine ? "你" : mpickEsc(mpickName(view.current_player));
    return { cls: "is-shown", html: who + "正在从三张里挑两张。" };
  }
  if (view.phase === "pick_order") {
    const who = mine ? "你" : mpickEsc(mpickName(view.current_player));
    return { cls: "is-shown", html: who + "正在接一张新订单。" };
  }
  if (mine) {
    return { cls: "is-shown is-you", html: "轮到你，从菌窝、公共牌区或手牌里选一个行动。" };
  }
  if (view.final_turns_left !== null && view.final_turns_left !== undefined) {
    return { cls: "is-shown", html: "最后一轮，还剩 " + view.final_turns_left + " 个回合。" };
  }
  return { cls: "", html: "" };
}

function mpickPublicHTML() {
  const view = mpickView;
  const cards = view.public || [];
  if (!cards.length) {
    return '<span class="mushroom-empty">公共牌区是空的</span>';
  }
  const canTake = mpickLegal("take");
  const swapping = !!mpickSwap?.give;
  const html = cards.map((card) => {
    const open = (canTake && !mpickTake && !mpickSwap) || swapping;
    return mpickCardHTML(card, {
      open,
      picked: mpickTake === card.id,
      dim: !!mpickTake && mpickTake !== card.id,
      pick: open ? "public:" + card.id : null
    });
  }).join("");
  if (!mpickTake) return html;
  const card = cards.find((item) => item.id === mpickTake);
  if (!card) return html;
  return html + mpickMaskHTML("拿走 " + card.zh, "take");
}

function mpickOrdersHTML() {
  const view = mpickView;
  const orders = view.order_center || [];
  if (!orders.length) {
    return '<span class="mushroom-empty">订单牌堆已经用完</span>';
  }
  const picking = view.phase === "pick_order" && mpickMyTurn();
  const html = orders.map((order) => mpickOrderHTML(order, {
    open: picking,
    picked: mpickPick === order.id,
    centre: picking ? order.id : null
  })).join("");
  if (!mpickPick) return html;
  return html + mpickMaskHTML("接下", "pick");
}

function mpickGroupsHTML(player) {
  const groups = player.scored_groups || [];
  if (!groups.length) return "";
  return groups.map((group) => '<span class="mushroom-group">'
    + group.emoji + mpickEsc(group.zh) + "×" + group.count + "</span>").join("");
}

function mpickPlayerHTML(player) {
  const view = mpickView;
  const classes = ["mushroom-player"];
  if (player.is_current) classes.push("is-current");
  if (player.is_you) classes.push("is-you");
  const mine = player.is_you;
  const orders = view.mode === "orders";
  const target = mine ? mpickTargetOrder() : null;
  const active = (player.orders || []).map((order) => {
    const ready = mine && (player.orders_ready || []).includes(order.id);
    return mpickOrderHTML(order, {
      mini: true,
      ready,
      target: !!target && target.id === order.id,
      pick: mine && mpickMyTurn() && view.phase === "action" ? order.id : null
    });
  }).join("");
  const done = (player.done_orders || []).length;
  return '<div class="' + classes.join(" ") + '" data-mpick-explain="player_row">'
    + '<div class="mushroom-player-head">'
    + '<span class="mushroom-player-name">' + mpickEsc(player.name)
    + (player.is_you ? "（你）" : "") + "</span>"
    + '<span class="mushroom-player-score" data-mpick-explain="scored">' + player.score + " 分</span>"
    + '<span class="mushroom-player-hand">✋ ' + player.hand_count + "</span>"
    + "</div>"
    + (orders
      ? '<div class="mushroom-player-orders" data-mpick-explain="my_orders">' + active + "</div>"
        + (done ? '<div class="mushroom-player-done" data-mpick-explain="done_orders">已完成 '
          + done + " 张订单</div>" : "")
      : '<div class="mushroom-player-groups" data-mpick-explain="scored">'
        + (mpickGroupsHTML(player) || '<span class="mushroom-empty">得分区还是空的</span>') + "</div>")
    + "</div>";
}

function mpickHandHTML() {
  const view = mpickView;
  const me = mpickMe();
  if (!me) return "";
  if (view.phase === "keep" && view.pending_draw && mpickMyTurn()) {
    return view.pending_draw.map((card, index) => mpickCardHTML(card, {
      selected: mpickKeep.includes(index),
      open: true,
      index,
      pick: "keep:" + index
    })).join("");
  }
  if (!me.hand || !me.hand.length) {
    return '<span class="mushroom-empty">手上还没有牌</span>';
  }
  const order = view.mode === "orders" ? mpickTargetOrder() : null;
  const playable = mpickMyTurn() && mpickLegal("play");
  return me.hand.map((card) => {
    let hint = false;
    if (order) {
      hint = (order.slots || []).some((slot) => (
        slot.card ? slot.card === card.key : slot.star === card.star
      ));
    }
    return mpickCardHTML(card, {
      selected: mpickSel.includes(card.id),
      open: playable || !!mpickSwap,
      dim: !!order && !hint && !mpickSel.includes(card.id),
      pick: playable || mpickSwap ? "hand:" + card.id : null
    });
  }).join("");
}

function mpickActionBarHTML() {
  const view = mpickView;
  if (!mpickMyTurn()) return "";
  if (view.phase === "keep") {
    const need = Math.min(2, (view.pending_draw || []).length);
    const left = need - mpickKeep.length;
    const label = left > 0 ? "还要选 " + left + " 张" : "留下这 " + need + " 张";
    return mpickBarHTML(
      mpickGoButton(label, "keep", left > 0) + mpickCancelButton(), "keep");
  }
  if (view.phase === "pick_order") {
    return mpickBarHTML(
      '<span class="mushroom-bar-note">点中央订单，在蒙版里确认接下它</span>'
      + mpickCancelButton(), "orders");
  }
  if (mpickSwap) {
    const note = mpickSwap.give
      ? "再点公共牌区里要换进来的牌"
      : "先点一张手牌换出去";
    return mpickBarHTML('<span class="mushroom-bar-note">' + note + "</span>"
      + mpickCancelButton(), "swap");
  }
  if (view.mode === "orders") {
    const order = mpickTargetOrder();
    if (!order) {
      return mpickBarHTML(
        '<span class="mushroom-bar-note">先点一张自己面前的订单</span>', "my_orders");
    }
    const need = (order.slots || []).length;
    const cards = mpickSelectedCards();
    const ok = cards.length === need && mpickFillsOrder(order, cards);
    const note = order.zh + " 需要 " + mpickSlotsText(order)
      + "，已选 " + cards.length + "/" + need;
    return mpickBarHTML(
      '<span class="mushroom-bar-note">' + mpickEsc(note) + "</span>"
      + mpickGoButton("完成订单 +" + order.points, "order", !ok)
      + mpickCancelButton(), "playbar");
  }
  const cards = mpickSelectedCards();
  if (!cards.length) return "";
  const problem = mpickPlayProblem(cards);
  if (problem) {
    return mpickBarHTML('<span class="mushroom-bar-note is-bad">' + mpickEsc(problem)
      + "</span>" + mpickCancelButton(), "playbar");
  }
  const hasMaotou = cards.some((card) => card.key === "maotou");
  if (hasMaotou) {
    const scored = mpickPlayScore(cards, "score");
    const cleared = mpickPlayScore(cards, "clear");
    const row = (view.public || []).length;
    return mpickBarHTML(
      '<span class="mushroom-bar-note">毛头鬼伞二选一，公共牌区还有 ' + row + " 张</span>"
      + mpickGoButton("得分 +" + scored, "play:score")
      + mpickGoButton("清空公共区 +" + cleared, "play:clear")
      + mpickCancelButton(), "playbar");
  }
  const points = mpickPlayScore(cards, "score");
  return mpickBarHTML(
    '<span class="mushroom-bar-note">已选 ' + cards.length + " 张</span>"
    + mpickGoButton("打出 +" + points, "play")
    + mpickCancelButton(), "playbar");
}

function mpickSettleHTML() {
  const view = mpickView;
  if (view.stage === "play" || !view.final_scores) return "";
  const rows = view.players.map((player) => {
    const entry = view.final_scores[player.player_id];
    if (!entry) return "";
    const winner = (view.winners || []).includes(player.player_id);
    const lines = (entry.lines || []).map((line) => '<div class="mushroom-settle-line">'
      + "<span>" + mpickEsc(line.label_zh) + "</span>"
      + '<span class="' + (line.points < 0 ? "is-bad" : "") + '">'
      + (line.points > 0 ? "+" : "") + line.points + "</span></div>").join("");
    return '<div class="mushroom-settle-row' + (winner ? " is-winner" : "") + '">'
      + '<div class="mushroom-settle-head"><span>' + mpickEsc(player.name)
      + (player.is_you ? "（你）" : "") + "</span>"
      + "<strong>" + entry.total + " 分</strong></div>" + lines + "</div>";
  }).join("");
  return '<div class="mushroom-settle-title">结算</div>' + rows;
}

function mpickRender() {
  if (!mpickPanel) return;
  if (!mpickView) { mpickPanel.innerHTML = ""; return; }
  const view = mpickView;
  mpickLearnExplanations();

  const mode = document.getElementById("mushroomMode");
  if (mode) mode.textContent = view.mode === "orders" ? "📜 玩法二 订单" : "🍄 玩法一 基础";
  const turn = document.getElementById("mushroomTurn");
  if (turn) {
    const mine = view.current_player === view.you;
    turn.textContent = view.game_over ? "本局结束"
      : (view.stage === "scoring" ? "结算中" : (mine ? "轮到你" : mpickName(view.current_player)));
    turn.classList.toggle("is-you", mine && view.stage === "play");
    turn.title = "第 " + view.turn + " 回合";
  }
  const pass = document.getElementById("mushroomPass");
  if (pass) pass.hidden = !mpickLegal("pass");

  const banner = document.getElementById("mushroomBanner");
  if (banner) {
    const built = mpickBannerHTML();
    banner.className = "mushroom-banner " + built.cls;
    banner.innerHTML = built.html;
  }

  const nest = document.getElementById("mushroomNest");
  if (nest) {
    nest.classList.toggle("is-open", mpickLegal("draw"));
    nest.disabled = !mpickLegal("draw");
  }
  const nestCount = document.getElementById("mushroomNestCount");
  if (nestCount) nestCount.textContent = view.deck_count;

  const publicNote = document.getElementById("mushroomPublicNote");
  if (publicNote) publicNote.textContent = (view.public || []).length + " 张 · 弃牌 " + view.discard_count;
  const publicRow = document.getElementById("mushroomPublic");
  if (publicRow) {
    publicRow.classList.toggle("is-empty", !(view.public || []).length);
    publicRow.innerHTML = mpickPublicHTML();
  }

  const orderBlock = document.getElementById("mushroomOrderBlock");
  if (orderBlock) orderBlock.hidden = view.mode !== "orders";
  const orderNote = document.getElementById("mushroomOrderNote");
  if (orderNote) orderNote.textContent = "订单牌堆 " + view.order_deck_count + " 张";
  const orderRow = document.getElementById("mushroomOrders");
  if (orderRow) {
    orderRow.classList.toggle("is-empty", !(view.order_center || []).length);
    orderRow.innerHTML = mpickOrdersHTML();
  }

  const playersNote = document.getElementById("mushroomPlayersNote");
  if (playersNote) {
    const me = mpickMe();
    playersNote.textContent = me ? "你 " + me.score + " 分 · 手牌 " + me.hand_count : "";
  }
  const players = document.getElementById("mushroomPlayers");
  if (players) players.innerHTML = (view.players || []).map(mpickPlayerHTML).join("");

  const handTitle = document.getElementById("mushroomHandTitle");
  if (handTitle) {
    handTitle.textContent = view.phase === "keep" && mpickMyTurn() ? "挑两张留下" : "你的手牌";
  }
  const handNote = document.getElementById("mushroomHandNote");
  if (handNote) {
    const me = mpickMe();
    const bits = [];
    if (me) bits.push(me.hand_count + " 张");
    if (mpickLegal("swap")) bits.push("映月居可换牌");
    handNote.textContent = bits.join(" · ");
  }
  const hand = document.getElementById("mushroomHand");
  if (hand) {
    const handCount = (mpickMe()?.hand || []).length
      + ((view.phase === "keep" && view.pending_draw && mpickMyTurn()) ? view.pending_draw.length : 0);
    hand.classList.toggle("is-empty", handCount === 0);
    hand.innerHTML = mpickHandHTML();
  }

  const bar = document.getElementById("mushroomActionBar");
  if (bar) bar.innerHTML = mpickActionBarHTML();

  const settle = document.getElementById("mushroomSettle");
  if (settle) {
    settle.innerHTML = mpickSettleHTML();
    settle.hidden = !settle.innerHTML;
  }

  const log = document.getElementById("mushroomLog");
  if (log) {
    log.innerHTML = (view.log || []).slice(-40)
      .map((line) => "<div>" + mpickEsc(line) + "</div>").join("");
    log.scrollTop = log.scrollHeight;
  }

  // The swap button lives next to the hand note so it never covers a card.
  const swapHost = document.getElementById("mushroomHandNote");
  if (swapHost && !document.getElementById("mushroomSwapBtn")) {
    swapHost.insertAdjacentHTML("afterend",
      '<button type="button" class="mushroom-swapbtn" id="mushroomSwapBtn"'
      + ' data-mpick-swap="1" data-mpick-explain="swap" hidden>映月居换牌</button>');
  }
  const swapBtn = document.getElementById("mushroomSwapBtn");
  if (swapBtn) {
    swapBtn.hidden = !mpickLegal("swap");
    swapBtn.classList.toggle("is-active", !!mpickSwap);
  }
}

/* --- actions ----------------------------------------------------------- */

function mpickClearSelection() {
  mpickSel = [];
  mpickTake = null;
  mpickKeep = [];
  mpickSwap = null;
  mpickPick = null;
}

function mpickSend(action) {
  if (mpickPending) return;
  mpickPending = true;
  window.clearTimeout(mpickPendingTimer);
  mpickPendingTimer = window.setTimeout(() => {
    mpickPending = false;
    mpickRender();
  }, 8000);
  mpickClearSelection();
  if (typeof sendAction === "function") sendAction(action);
  mpickRender();
}

function mpickSyncOrderTarget() {
  const view = mpickView;
  if (!view || view.mode !== "orders") { mpickOrder = null; return; }
  const me = mpickMe();
  if (!me || !me.orders.length) { mpickOrder = null; return; }
  if (mpickOrder && me.orders.some((order) => order.id === mpickOrder)) return;
  mpickOrder = (me.orders_ready && me.orders_ready[0]) || me.orders[0].id;
}

function mpickHandleGo(action) {
  const view = mpickView;
  const turn = view.turn;
  if (action === "take") {
    if (mpickTake && mpickLegal("take")) {
      mpickSend({ type: "take", turn, card: mpickTake });
    }
    return;
  }
  if (action === "pick") {
    if (mpickPick && view.phase === "pick_order" && mpickMyTurn()) {
      mpickSend({ type: "pick_order", turn, order: mpickPick });
    }
    return;
  }
  if (action === "keep") {
    if (mpickLegal("keep")) {
      mpickSend({ type: "keep", turn, keep: mpickKeep.slice().sort((a, b) => a - b) });
    }
    return;
  }
  if (action === "order") {
    const order = mpickTargetOrder();
    const cards = mpickSelectedCards();
    if (order && mpickLegal("play") && mpickFillsOrder(order, cards)) {
      mpickSend({ type: "play", turn, order: order.id, cards: cards.map((card) => card.id) });
    }
    return;
  }
  if (action === "play" || action.startsWith("play:")) {
    const cards = mpickSelectedCards();
    if (!cards.length || !mpickLegal("play")) return;
    const payload = { type: "play", turn, cards: cards.map((card) => card.id) };
    if (action.startsWith("play:")) payload.choice = action.split(":")[1];
    else if (cards.some((card) => card.key === "maotou")) payload.choice = "score";
    mpickSend(payload);
  }
}

function mpickHandlePick(key) {
  const view = mpickView;
  const [kind, id] = key.split(":");
  if (kind === "public") {
    if (mpickSwap?.give) {
      mpickSend({ type: "swap", turn: view.turn, give: mpickSwap.give, take: id });
      return;
    }
    mpickTake = mpickTake === id ? null : id;
    mpickRender();
    return;
  }
  if (kind === "hand") {
    if (mpickSwap) {
      mpickSwap = mpickSwap.give === id ? null : { give: id };
      mpickRender();
      return;
    }
    mpickSel = mpickSel.includes(id)
      ? mpickSel.filter((item) => item !== id)
      : mpickSel.concat([id]);
    mpickRender();
    return;
  }
  if (kind === "keep") {
    const index = Number(id);
    mpickKeep = mpickKeep.includes(index)
      ? mpickKeep.filter((item) => item !== index)
      : mpickKeep.concat([index]);
    mpickRender();
  }
}

function mpickBindPanel() {
  if (!mpickPanel || mpickPanel.dataset.mpickBound === "1") return;
  mpickPanel.dataset.mpickBound = "1";
  document.addEventListener("pointerdown", () => {
    mpickExplainPress = !!mpickExplainWidget?.isActive();
  }, true);
  mpickPanel.addEventListener("click", (event) => {
    if (mpickExplainWidget?.isActive()) return;
    if (mpickExplainPress) { mpickExplainPress = false; return; }
    if (!mpickView) return;

    const go = event.target.closest("[data-mpick-go]");
    if (go) {
      mpickHandleGo(go.getAttribute("data-mpick-go"));
      return;
    }
    if (event.target.closest("[data-mpick-cancel]")) {
      mpickClearSelection();
      mpickRender();
      return;
    }
    if (event.target.closest("[data-mpick-continue]")) {
      if (mpickLegal("continue")) mpickSend({ type: "continue", turn: mpickView.turn });
      return;
    }
    if (event.target.closest("[data-mpick-again]")) {
      if (mpickLegal("play_again")) mpickSend({ type: "play_again" });
      return;
    }
    if (event.target.closest("#mushroomPass")) {
      if (mpickLegal("pass")) mpickSend({ type: "pass", turn: mpickView.turn });
      return;
    }
    if (event.target.closest("#mushroomNest")) {
      if (mpickLegal("draw")) mpickSend({ type: "draw", turn: mpickView.turn });
      return;
    }
    const swap = event.target.closest("[data-mpick-swap]");
    if (swap) {
      mpickSwap = mpickSwap ? null : { give: null };
      mpickSel = [];
      mpickRender();
      return;
    }
    const centre = event.target.closest("[data-mpick-centre]");
    if (centre) {
      const id = centre.getAttribute("data-mpick-centre");
      mpickPick = mpickPick === id ? null : id;
      mpickRender();
      return;
    }
    const order = event.target.closest("[data-mpick-order]");
    if (order) {
      const id = order.getAttribute("data-mpick-order");
      mpickOrder = mpickOrder === id ? null : id;
      mpickSel = [];
      mpickRender();
      return;
    }
    const pick = event.target.closest("[data-mpick-pick]");
    if (pick) {
      mpickHandlePick(pick.getAttribute("data-mpick-pick"));
      return;
    }
    if (!event.target.closest(".mushroom-mask")) {
      mpickClearSelection();
      mpickRender();
    }
  });
}

function mpickReset() {
  mpickView = null;
  mpickClearSelection();
  mpickOrder = null;
  mpickPending = false;
  mpickSignature = null;
  window.clearTimeout(mpickPendingTimer);
  if (mpickPanel) mpickPanel.innerHTML = "";
}

window.renderMushroomPickingGameState = (data) => {
  const next = data?.view || data;
  if (!next?.players || next.game_id !== "mushroom_picking") return;
  const signature = JSON.stringify([
    data?.room_id, next.turn, next.stage, next.phase, next.current_player,
    next.deck_count, (next.public || []).length, next.pending_count
  ]);
  if (signature !== mpickSignature) {
    mpickClearSelection();
    mpickPending = false;
    window.clearTimeout(mpickPendingTimer);
  }
  mpickSignature = signature;
  mpickView = next;
  mpickSyncOrderTarget();
  initMushroomPickingHelpExplain();
  mpickBindPanel();
  mpickRender();
};

window.showMushroomPickingHeaderActions = (visible) => {
  if (mpickHeader) mpickHeader.style.display = visible ? "flex" : "none";
  if (!visible) mpickReset();
};
window.clearMushroomPickingState = mpickReset;

function initMushroomPickingHelpExplain() {
  if (mpickHelpWidget || typeof window.obgCreateHelp !== "function") return;
  mpickHelpWidget = window.obgCreateHelp(MPICK_HELP_CONFIG);
  mpickExplainWidget = window.obgCreateExplain({
    gameId: "mushroom_picking",
    attribute: "data-mpick-explain",
    explanations: MPICK_EXPLAIN,
    button: mpickExplainButton,
    root: () => document.getElementById("mushroomPickingPanel"),
    bypass: ["#mushroomPickingHelpBtn", "#mushroomPickingExplainBtn"]
  });
}

mpickHelpButton?.addEventListener("click", () => {
  initMushroomPickingHelpExplain();
  mpickHelpWidget?.open();
});
mpickExplainButton?.addEventListener("click", () => {
  initMushroomPickingHelpExplain();
  mpickExplainWidget?.toggle();
});

document.addEventListener("keydown", (event) => {
  if (!mpickView || event.key !== "Escape") return;
  if (mpickExplainWidget?.isActive()) return;
  if (!mpickSel.length && !mpickTake && !mpickKeep.length && !mpickSwap && !mpickPick) return;
  mpickClearSelection();
  mpickRender();
}, true);

function connectMushroomPickingEvents() {
  if (typeof socket === "undefined") return;
  socket.on("system:error", () => {
    if (mpickPending) {
      mpickPending = false;
      window.clearTimeout(mpickPendingTimer);
      mpickRender();
    }
  });
  if (typeof currentRoomState !== "undefined" && currentRoomState) {
    window.renderMushroomPickingGameState(currentRoomState);
  }
}
if (document.readyState === "loading" || typeof socket === "undefined") {
  window.addEventListener("DOMContentLoaded", connectMushroomPickingEvents, { once: true });
} else {
  connectMushroomPickingEvents();
}
