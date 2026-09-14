let currentForestShuffleView = null;
let forestShuffleSelectedCardId = null;
let forestShuffleSelectedHalfIndex = null;
let forestShuffleSelectedTreeId = null;
let forestShuffleDeckDrawCount = 0;
let forestShuffleSelectedClearingIds = new Set();
let forestShuffleSelectedPaymentIds = new Set();
let forestShuffleSelectedRaccoonIds = new Set();
let forestShuffleExplainMode = false;
let forestShufflePreferredLanguage = "en";

const forestShufflePanel = document.getElementById("forestShufflePanel");
const forestShuffleHeaderActions = document.getElementById("forestShuffleHeaderActions");
const forestShuffleHelpBtn = document.getElementById("forestShuffleHelpBtn");
const forestShuffleExplainBtn = document.getElementById("forestShuffleExplainBtn");
const forestShuffleHelpModal = document.getElementById("forestShuffleHelpModal");
const forestShuffleHelpModalCloseBtn = document.getElementById("forestShuffleHelpModalCloseBtn");
const forestShuffleExplainModal = document.getElementById("forestShuffleExplainModal");
const forestShuffleExplainModalCloseBtn = document.getElementById("forestShuffleExplainModalCloseBtn");
const forestShuffleHelpContent = document.getElementById("forestShuffleHelpContent");
const forestShuffleExplainContent = document.getElementById("forestShuffleExplainContent");
const forestShuffleHelpTitle = document.getElementById("forestShuffleHelpTitle");
const forestShuffleExplainTitle = document.getElementById("forestShuffleExplainTitle");
const forestShuffleCurrentTurnText = document.getElementById("forestShuffleCurrentTurnText");
const forestShuffleWinterText = document.getElementById("forestShuffleWinterText");
const forestShuffleDeckText = document.getElementById("forestShuffleDeckText");
const forestShuffleWinnerText = document.getElementById("forestShuffleWinnerText");
const forestShuffleTurnLabel = document.getElementById("forestShuffleTurn");
const forestShuffleWinterLabel = document.getElementById("forestShuffleWinter");
const forestShuffleDeckLabel = document.getElementById("forestShuffleDeck");
const forestShuffleWinnerLabel = document.getElementById("forestShuffleWinner");
const forestShuffleStatus = document.getElementById("forestShuffleStatus");
const forestShuffleActionHint = document.getElementById("forestShuffleActionHint");
const forestShuffleSelectionSummary = document.getElementById("forestShuffleSelectionSummary");
const forestShuffleDrawSources = document.getElementById("forestShuffleDrawSources");
const forestShuffleClearing = document.getElementById("forestShuffleClearing");
const forestShuffleHand = document.getElementById("forestShuffleHand");
const forestShufflePlayers = document.getElementById("forestShufflePlayers");
const forestShuffleDrawBtn = document.getElementById("forestShuffleDrawBtn");
const forestShufflePlayBtn = document.getElementById("forestShufflePlayBtn");
const forestShuffleSaplingBtn = document.getElementById("forestShuffleSaplingBtn");
const forestShuffleFinishPendingBtn = document.getElementById("forestShuffleFinishPendingBtn");
const forestShuffleResolveRaccoonBtn = document.getElementById("forestShuffleResolveRaccoonBtn");
const forestShuffleNotes = document.getElementById("forestShuffleNotes");
const forestShuffleActionTitle = document.getElementById("forestShuffleActionTitle");
const forestShuffleClearingTitle = document.getElementById("forestShuffleClearingTitle");
const forestShuffleHandTitle = document.getElementById("forestShuffleHandTitle");
const forestShufflePlayersTitle = document.getElementById("forestShufflePlayersTitle");

const FOREST_SHUFFLE_COPY = {
  en: {
    helpTitle: "Forest Shuffle - Game Rules",
    explainTitle: "Button Explanation",
    currentTurn: "Current Turn",
    winter: "Winter",
    deck: "Deck",
    winner: "Winner",
    actionConsole: "Action Console",
    clearing: "Clearing",
    yourHand: "Your Hand",
    players: "Players",
    drawSelected: "Draw Selected",
    finishPending: "Finish Pending",
    confirmCave: "Confirm Cave",
    playSelected: "Play Selected",
    playAsSapling: "Play As Sapling",
    gameOver: "Game over. Score previews are final.",
    chooseAction: "Choose one action: draw two cards, or play one card from hand.",
    resolvePending: "Resolve the current pending effect.",
    raccoonHint: "Raccoon: mark any remaining hand cards to tuck under your cave, then confirm.",
    noCardSelected: "No card selected.",
    card: "Card",
    half: "Half",
    payments: "Payments",
    tree: "Tree",
    cost: "Cost",
    payment: "Payment",
    splitVertical: "↕ Split",
    splitHorizontal: "↔ Split",
    select: "Select",
    sapling: "Sapling",
    pay: "Pay",
    unpay: "Unpay",
    markForCave: "Mark For Cave",
    removeFromCave: "Remove From Cave",
    empty: "Empty",
    you: "You",
    scoreBreakdown: "Score Breakdown",
    note: "Note",
    treeSapling: "Tree Sapling",
    helpHtml: `
      <h3>Scope</h3>
      <p>This room implements the Forest Shuffle base-game core loop: draw, pay, place, resolve, clear the clearing, and score when the 3rd winter arrives.</p>
      <p>This build uses synthetic split-card pairings and approximate tree-symbol distribution. The turn flow and card scoring are implemented, but exact physical deck pairing is not final.</p>
      <h3>Turn</h3>
      <ul>
        <li><strong>Draw Two Cards</strong>: select up to two sources from the deck and/or the clearing.</li>
        <li><strong>Play One Card</strong>: choose a hand card, select payment cards, and if needed click a tree slot to place it.</li>
      </ul>
      <h3>Placement</h3>
      <ul>
        <li>Trees create new 4-sided homes in your forest.</li>
        <li>Split cards need a matching side slot on one of your trees or saplings.</li>
        <li>European Hares can stack with more European Hares. Common Toads can share a bottom slot in pairs.</li>
      </ul>
      <h3>Pending Effects</h3>
      <ul>
        <li><strong>Free Play</strong>: some bonuses let you place a matching card for free. The free card keeps normal placement rules, but its own effect and bonus are skipped.</li>
        <li><strong>Raccoon</strong>: select any remaining hand cards to tuck under your cave, then draw the same amount.</li>
      </ul>
      <h3>Known Limitation</h3>
      <ul>
        <li><strong>Mole</strong>: the card is present and scores correctly, but its complex extra multi-play effect is not fully implemented in this build.</li>
      </ul>
    `,
    explanations: {
      status: { name: "Status", description: "Shows whose turn it is, how close winter is, and whether the game has ended." },
      action: { name: "Action Console", description: "Use this area to assemble a draw action, finish a pending effect, or submit the currently selected play." },
      clearing: { name: "Clearing", description: "Paid cards and revealed tree cards go here. You can also take clearing cards when choosing the draw action." },
      hand: { name: "Your Hand", description: "Choose a card half to play, toggle payment cards, or mark cards for the Raccoon cave effect." },
      players: { name: "Players", description: "Each player card shows public forest state, cave count, score preview, and the tree-slot layout. Click one of your tree slots after selecting a split card." },
      forestShuffleDrawBtn: { name: "Draw Selected", description: "Confirm the selected deck and clearing sources for your draw action." },
      forestShufflePlayBtn: { name: "Play Selected", description: "Confirm the currently selected card, payment cards, and target tree slot." },
      forestShuffleSaplingBtn: { name: "Play As Sapling", description: "Play the selected hand card face down as a universal tree sapling." },
      forestShuffleFinishPendingBtn: { name: "Finish Pending", description: "Skip the rest of the current free-play opportunity and end the turn if nothing else is pending." },
      forestShuffleResolveRaccoonBtn: { name: "Confirm Cave", description: "Resolve the Raccoon effect by moving the selected hand cards under your cave and drawing replacements." },
    },
  },
  zh: {
    helpTitle: "Forest Shuffle - 游戏规则",
    explainTitle: "按钮说明",
    currentTurn: "当前回合",
    winter: "冬季",
    deck: "牌库",
    winner: "获胜者",
    actionConsole: "行动区",
    clearing: "林间空地",
    yourHand: "你的手牌",
    players: "玩家",
    drawSelected: "抽取所选",
    finishPending: "结束待处理效果",
    confirmCave: "确认洞穴",
    playSelected: "打出所选",
    playAsSapling: "作为树苗打出",
    gameOver: "游戏结束，显示的分数为最终分数。",
    chooseAction: "选择一个行动：抽两张牌，或从手牌打出一张牌。",
    resolvePending: "请处理当前待结算效果。",
    raccoonHint: "浣熊：标记任意剩余手牌放入洞穴，然后确认。",
    noCardSelected: "尚未选择卡牌。",
    card: "卡牌",
    half: "半边",
    payments: "支付牌数",
    tree: "树木",
    cost: "费用",
    payment: "支付符号",
    splitVertical: "↕ 上下牌",
    splitHorizontal: "↔ 左右牌",
    select: "选择",
    sapling: "树苗",
    pay: "用于支付",
    unpay: "取消支付",
    markForCave: "放入洞穴",
    removeFromCave: "移出洞穴",
    empty: "空",
    you: "你",
    scoreBreakdown: "计分明细",
    note: "说明",
    treeSapling: "树苗",
    helpHtml: `
      <h3>游戏范围</h3>
      <p>本房间实现了 Forest Shuffle 基础版的核心流程：抽牌、支付、放置、结算效果、清空林间空地，并在第三张冬季牌出现时计分。</p>
      <p>当前版本使用合成的双边牌组合和近似的树木符号分布。回合流程与卡牌计分已实现，但实体牌组中的准确配对仍未完成。</p>
      <h3>你的回合</h3>
      <ul>
        <li><strong>抽两张牌</strong>：从牌库和／或林间空地选择至多两个来源。</li>
        <li><strong>打出一张牌</strong>：选择一张手牌和支付牌；如果需要，再点击树木上的对应位置。</li>
      </ul>
      <h3>放置规则</h3>
      <ul>
        <li>树木会在你的森林中建立一个拥有上、下、左、右四个位置的新家园。</li>
        <li>双边牌必须放到树木或树苗上方向相符的位置。</li>
        <li>欧洲野兔可以在同一位置叠放；同一底部位置最多可放两只普通蟾蜍。</li>
      </ul>
      <h3>待处理效果</h3>
      <ul>
        <li><strong>免费打出</strong>：部分奖励允许免费放置符合条件的牌。它仍须遵守通常的放置规则，但不会触发自身效果与奖励。</li>
        <li><strong>浣熊</strong>：选择任意剩余手牌放入洞穴，然后抽取同样数量的牌。</li>
      </ul>
      <h3>已知限制</h3>
      <ul>
        <li><strong>鼹鼠</strong>：该牌已加入且计分正确，但复杂的额外多次出牌效果尚未完整实现。</li>
      </ul>
    `,
    explanations: {
      status: { name: "状态", description: "显示当前轮到谁、冬季进度，以及游戏是否已经结束。" },
      action: { name: "行动区", description: "在这里组合抽牌行动、结束待处理效果，或提交当前选定的出牌。" },
      clearing: { name: "林间空地", description: "用于支付的牌和翻开的树木牌会进入这里。选择抽牌行动时也可以拿取空地中的牌。" },
      hand: { name: "你的手牌", description: "选择要打出的卡牌半边、切换支付牌，或为浣熊效果标记要放入洞穴的牌。" },
      players: { name: "玩家", description: "每位玩家的区域会显示公开森林、洞穴牌数、预览分数和树木位置。选择双边牌后，点击自己树木上的对应位置。" },
      forestShuffleDrawBtn: { name: "抽取所选", description: "确认本次抽牌行动选中的牌库与林间空地来源。" },
      forestShufflePlayBtn: { name: "打出所选", description: "确认当前选中的卡牌、支付牌和目标树木位置。" },
      forestShuffleSaplingBtn: { name: "作为树苗打出", description: "将选中的手牌背面朝上打出，作为可容纳任意动物的树苗。" },
      forestShuffleFinishPendingBtn: { name: "结束待处理效果", description: "放弃剩余的免费出牌机会；如果没有其他待处理效果，则结束回合。" },
      forestShuffleResolveRaccoonBtn: { name: "确认洞穴", description: "把选中的手牌放入洞穴，并抽取相同数量的替代牌，以结算浣熊效果。" },
    },
  },
};

const FOREST_SYMBOL_STYLES = {
  beech: { label: "Beech", emoji: "🌳", tone: "beech" },
  birch: { label: "Birch", emoji: "🌱", tone: "birch" },
  douglas_fir: { label: "Douglas Fir", emoji: "🌲", tone: "fir" },
  horse_chestnut: { label: "Horse Chestnut", emoji: "🌰", tone: "chestnut" },
  linden_tree: { label: "Linden", emoji: "🍃", tone: "linden" },
  oak: { label: "Oak", emoji: "🌿", tone: "oak" },
  silver_fir: { label: "Silver Fir", emoji: "❄️", tone: "silver" },
  sycamore: { label: "Sycamore", emoji: "🍁", tone: "sycamore" },
};

const FOREST_TAG_ICONS = {
  tree: "🌳",
  bird: "🐦",
  butterfly: "🦋",
  bat: "🦇",
  pawed: "🐾",
  deer: "🦌",
  cloven: "🦌",
  hare: "🐇",
  insect: "🐞",
  plant: "🌿",
  mushroom: "🍄",
  amphibian: "🐸",
};

const FOREST_SHUFFLE_SPECIES_ZH = {
  beech: "山毛榉",
  birch: "桦树",
  douglas_fir: "花旗松",
  horse_chestnut: "七叶树",
  linden_tree: "椴树",
  oak: "橡树",
  silver_fir: "银冷杉",
  sycamore: "悬铃木",
  camberwell_beauty: "黄缘蛱蝶",
  large_tortoiseshell: "大蛱蝶",
  peacock_butterfly: "孔雀蛱蝶",
  purple_emperor: "紫闪蛱蝶",
  silver_washed_fritillary: "银洗豹蛱蝶",
  bullfinch: "红腹灰雀",
  chaffinch: "苍头燕雀",
  eurasian_jay: "松鸦",
  goshawk: "苍鹰",
  great_spotted_woodpecker: "大斑啄木鸟",
  red_squirrel: "红松鼠",
  tawny_owl: "灰林鸮",
  chanterelle: "鸡油菌",
  fly_agaric: "毒蝇伞",
  parasol_mushroom: "高大环柄菇",
  penny_bun: "牛肝菌",
  common_toad: "普通蟾蜍",
  blackberries: "黑莓",
  fireflies: "萤火虫",
  fire_salamander: "火蝾螈",
  hedgehog: "刺猬",
  mole: "鼹鼠",
  moss: "苔藓",
  pond_turtle: "泽龟",
  stag_beetle: "锹形虫",
  tree_ferns: "树蕨",
  tree_frog: "树蛙",
  wild_strawberries: "野草莓",
  wood_ant: "木蚁",
  barbastelle_bat: "宽耳蝠",
  bechsteins_bat: "贝希斯坦蝙蝠",
  brown_long_eared_bat: "褐大耳蝠",
  greater_horseshoe_bat: "大菊头蝠",
  european_hare: "欧洲野兔",
  beech_marten: "石貂",
  brown_bear: "棕熊",
  european_badger: "欧洲獾",
  european_fat_dormouse: "欧洲睡鼠",
  fallow_deer: "黇鹿",
  gnat: "蚋",
  lynx: "猞猁",
  raccoon: "浣熊",
  red_deer: "马鹿",
  red_fox: "赤狐",
  roe_deer: "狍",
  squeaker: "小野猪",
  violet_carpenter_bee: "紫木蜂",
  wild_boar: "野猪",
  wolf: "狼",
  sapling: "树苗",
  cave: "洞穴",
};

const FOREST_SHUFFLE_TAG_LABELS = {
  en: {
    tree: "tree",
    bird: "bird",
    butterfly: "butterfly",
    bat: "bat",
    pawed: "pawed",
    deer: "deer",
    cloven: "cloven-hoofed",
    hare: "hare",
    insect: "insect",
    plant: "plant",
    mushroom: "mushroom",
    amphibian: "amphibian",
  },
  zh: {
    tree: "树木",
    bird: "鸟类",
    butterfly: "蝴蝶",
    bat: "蝙蝠",
    pawed: "有爪动物",
    deer: "鹿类",
    cloven: "偶蹄动物",
    hare: "野兔",
    insect: "昆虫",
    plant: "植物",
    mushroom: "蘑菇",
    amphibian: "两栖动物",
  },
};

const FOREST_SHUFFLE_SIDE_LABELS = {
  en: { top: "TOP", right: "RIGHT", bottom: "BOTTOM", left: "LEFT" },
  zh: { top: "上", right: "右", bottom: "下", left: "左" },
};

const FOREST_SHUFFLE_NOTE_ZH = {
  "Split cards use synthetic pairings built from the official base-game species counts.": "双边牌依据基础版的官方物种数量，以合成方式进行配对。",
  "Mole is included as a 0-point card, but its extra multi-play effect is not fully implemented yet.": "鼹鼠已作为 0 分卡牌加入，但其额外多次出牌效果尚未完整实现。",
};

function forestShuffleLanguage(view = currentForestShuffleView) {
  if (view && (view.language === "en" || view.language === "zh")) {
    return view.language;
  }
  return forestShufflePreferredLanguage;
}

function forestShuffleText(view = currentForestShuffleView) {
  return FOREST_SHUFFLE_COPY[forestShuffleLanguage(view)];
}

function forestShuffleSpeciesName(species, fallback, view = currentForestShuffleView) {
  if (forestShuffleLanguage(view) === "zh" && FOREST_SHUFFLE_SPECIES_ZH[species]) {
    return FOREST_SHUFFLE_SPECIES_ZH[species];
  }
  return fallback || (FOREST_SYMBOL_STYLES[species] || {}).label || species || "?";
}

function forestShuffleCardName(card, view = currentForestShuffleView) {
  if (!card) {
    return "?";
  }
  if (card.kind === "split" && Array.isArray(card.halves)) {
    return card.halves.map((half) => forestShuffleSpeciesName(half.species, half.name, view)).join(" / ");
  }
  return forestShuffleSpeciesName(card.species, card.name, view);
}

function forestShuffleTagLabel(tag, view = currentForestShuffleView) {
  const labels = FOREST_SHUFFLE_TAG_LABELS[forestShuffleLanguage(view)] || FOREST_SHUFFLE_TAG_LABELS.en;
  return labels[tag] || tag;
}

function forestShuffleSideLabel(side, view = currentForestShuffleView) {
  const labels = FOREST_SHUFFLE_SIDE_LABELS[forestShuffleLanguage(view)] || FOREST_SHUFFLE_SIDE_LABELS.en;
  return labels[side] || String(side || "").toUpperCase();
}

function forestShuffleExplanation(key) {
  return forestShuffleText().explanations[key] || null;
}

function forestShuffleApplyStaticText(view) {
  const copy = forestShuffleText(view);
  const labels = [
    [forestShuffleCurrentTurnText, copy.currentTurn],
    [forestShuffleWinterText, copy.winter],
    [forestShuffleDeckText, copy.deck],
    [forestShuffleWinnerText, copy.winner],
    [forestShuffleActionTitle, copy.actionConsole],
    [forestShuffleClearingTitle, copy.clearing],
    [forestShuffleHandTitle, copy.yourHand],
    [forestShufflePlayersTitle, copy.players],
    [forestShuffleDrawBtn, copy.drawSelected],
    [forestShuffleFinishPendingBtn, copy.finishPending],
    [forestShuffleResolveRaccoonBtn, copy.confirmCave],
    [forestShufflePlayBtn, copy.playSelected],
    [forestShuffleSaplingBtn, copy.playAsSapling],
    [forestShuffleHelpTitle, copy.helpTitle],
    [forestShuffleExplainTitle, copy.explainTitle],
  ];
  labels.forEach(([element, text]) => {
    if (element) {
      element.textContent = text;
    }
  });
}

function setForestShuffleLanguage(language) {
  forestShufflePreferredLanguage = language === "zh" ? "zh" : "en";
  forestShuffleApplyStaticText({ language: forestShufflePreferredLanguage });
}

function forestShufflePlayerName(view, playerId) {
  const player = (view.players || []).find((entry) => entry.player_id === playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function forestShuffleYou(view) {
  return (view.players || []).find((player) => player.player_id === view.you) || null;
}

function forestShufflePending(view) {
  return view && view.pending_action ? view.pending_action : null;
}

function forestShuffleCurrentHand(view) {
  const you = forestShuffleYou(view);
  return you && Array.isArray(you.hand) ? you.hand : [];
}

function forestShuffleSelectedCard(view) {
  return forestShuffleCurrentHand(view).find((card) => card.id === forestShuffleSelectedCardId) || null;
}

function forestShuffleSelectedHalf(view) {
  const card = forestShuffleSelectedCard(view);
  if (!card || card.kind !== "split" || !Array.isArray(card.halves)) {
    return null;
  }
  if (!Number.isInteger(forestShuffleSelectedHalfIndex)) {
    return null;
  }
  return card.halves[forestShuffleSelectedHalfIndex] || null;
}

function forestShuffleRequiredDrawCount(view) {
  const hand = forestShuffleCurrentHand(view);
  return Math.max(0, Math.min(2, 10 - hand.length));
}

function forestShuffleActiveSlot(view) {
  const half = forestShuffleSelectedHalf(view);
  return half ? half.slot : null;
}

function forestShuffleIsYourTurn(view) {
  return !!(view && view.you && view.current_turn === view.you);
}

function forestShuffleSyncSelections(view) {
  const handIds = new Set(forestShuffleCurrentHand(view).map((card) => card.id));
  if (forestShuffleSelectedCardId && !handIds.has(forestShuffleSelectedCardId)) {
    forestShuffleSelectedCardId = null;
    forestShuffleSelectedHalfIndex = null;
    forestShuffleSelectedTreeId = null;
  }
  forestShuffleSelectedPaymentIds = new Set([...forestShuffleSelectedPaymentIds].filter((cardId) => handIds.has(cardId) && cardId !== forestShuffleSelectedCardId));
  forestShuffleSelectedRaccoonIds = new Set([...forestShuffleSelectedRaccoonIds].filter((cardId) => handIds.has(cardId)));
  const clearingIds = new Set((view.clearing || []).map((card) => card.id));
  forestShuffleSelectedClearingIds = new Set([...forestShuffleSelectedClearingIds].filter((cardId) => clearingIds.has(cardId)));
  const you = forestShuffleYou(view);
  const treeIds = new Set((((you || {}).forest || {}).trees || []).map((tree) => tree.id));
  if (forestShuffleSelectedTreeId && !treeIds.has(forestShuffleSelectedTreeId)) {
    forestShuffleSelectedTreeId = null;
  }
}

function forestShuffleClearSelections() {
  forestShuffleSelectedCardId = null;
  forestShuffleSelectedHalfIndex = null;
  forestShuffleSelectedTreeId = null;
  forestShuffleDeckDrawCount = 0;
  forestShuffleSelectedClearingIds = new Set();
  forestShuffleSelectedPaymentIds = new Set();
  forestShuffleSelectedRaccoonIds = new Set();
}

function clearForestShuffleState() {
  currentForestShuffleView = null;
  forestShuffleClearSelections();
  if (forestShuffleTurnLabel) forestShuffleTurnLabel.textContent = "-";
  if (forestShuffleWinterLabel) forestShuffleWinterLabel.textContent = "-";
  if (forestShuffleDeckLabel) forestShuffleDeckLabel.textContent = "-";
  if (forestShuffleWinnerLabel) forestShuffleWinnerLabel.textContent = "-";
  if (forestShuffleStatus) forestShuffleStatus.textContent = "-";
  if (forestShuffleActionHint) forestShuffleActionHint.textContent = "-";
  if (forestShuffleSelectionSummary) forestShuffleSelectionSummary.textContent = "-";
  if (forestShuffleDrawSources) forestShuffleDrawSources.innerHTML = "";
  if (forestShuffleClearing) forestShuffleClearing.innerHTML = "";
  if (forestShuffleHand) forestShuffleHand.innerHTML = "";
  if (forestShufflePlayers) forestShufflePlayers.innerHTML = "";
  if (forestShuffleNotes) forestShuffleNotes.innerHTML = "";
  updateForestShuffleActionButtons();
}

function forestShuffleSymbolChip(symbol) {
  const meta = FOREST_SYMBOL_STYLES[symbol] || { label: symbol || "?", emoji: "🌲", tone: "oak" };
  const label = forestShuffleSpeciesName(symbol, meta.label);
  const chip = document.createElement("span");
  chip.className = `forest-shuffle-symbol tone-${meta.tone}`;
  chip.textContent = `${meta.emoji} ${label}`;
  chip.title = label;
  return chip;
}

function forestShuffleTagRow(tags) {
  const row = document.createElement("div");
  row.className = "forest-shuffle-tag-row";
  (tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "forest-shuffle-tag-chip";
    chip.textContent = `${FOREST_TAG_ICONS[tag] || "•"} ${forestShuffleTagLabel(tag)}`;
    row.appendChild(chip);
  });
  return row;
}

function forestShufflePendingHint(view) {
  const copy = forestShuffleText(view);
  const pending = forestShufflePending(view);
  if (!pending) {
    return copy.chooseAction;
  }
  if (pending.type === "free_play") {
    const labels = Array.isArray(pending.tags)
      ? pending.tags.map((tag) => `${FOREST_TAG_ICONS[tag] || "•"} ${forestShuffleTagLabel(tag, view)}`).join(" / ")
      : "-";
    if (forestShuffleLanguage(view) === "zh") {
      return pending.allow_multiple
        ? `免费出牌：可以打出任意张符合 ${labels} 的牌，或结束待处理效果。`
        : `免费出牌：可以打出一张符合 ${labels} 的牌，或结束待处理效果。`;
    }
    if (pending.allow_multiple) {
      return `Free play active: place any number of matching ${labels} cards, or finish pending.`;
    }
    return `Free play active: place one matching ${labels} card, or finish pending.`;
  }
  if (pending.type === "raccoon") {
    return copy.raccoonHint;
  }
  return copy.resolvePending;
}

function forestShuffleSelectionText(view) {
  const copy = forestShuffleText(view);
  const card = forestShuffleSelectedCard(view);
  if (!card) {
    return copy.noCardSelected;
  }
  const parts = [`${copy.card}: ${forestShuffleCardName(card, view)}`];
  if (card.kind === "split") {
    const half = forestShuffleSelectedHalf(view);
    parts.push(
      `${copy.half}: ${
        half
          ? `${forestShuffleSideLabel(half.slot, view)} ${forestShuffleSpeciesName(half.species, half.name, view)}`
          : "-"
      }`
    );
  }
  parts.push(`${copy.payments}: ${forestShuffleSelectedPaymentIds.size}`);
  parts.push(`${copy.tree}: ${forestShuffleSelectedTreeId || "-"}`);
  return parts.join(" | ");
}

function forestShufflePendingAllowsCard(view, card, half) {
  const pending = forestShufflePending(view);
  if (!pending || pending.type !== "free_play") {
    return true;
  }
  const required = new Set(pending.tags || []);
  if (card.kind === "tree") {
    return required.has("tree");
  }
  return !!half && (half.tags || []).some((tag) => required.has(tag));
}

function forestShuffleCardButton(text, onClick, selected = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "forest-shuffle-mini-btn";
  if (selected) {
    btn.classList.add("selected");
  }
  btn.textContent = text;
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return btn;
}

function forestShuffleRenderHand(view) {
  if (!forestShuffleHand) {
    return;
  }
  const copy = forestShuffleText(view);
  forestShuffleHand.innerHTML = "";
  const pending = forestShufflePending(view);
  const yourTurn = forestShuffleIsYourTurn(view) || !!pending;
  forestShuffleCurrentHand(view).forEach((card) => {
    const node = document.createElement("article");
    node.className = "forest-shuffle-card";
    if (card.id === forestShuffleSelectedCardId) {
      node.classList.add("selected");
    }

    const title = document.createElement("div");
    title.className = "forest-shuffle-card-title";
    title.textContent = forestShuffleCardName(card, view);
    node.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "forest-shuffle-card-meta";
    if (card.kind === "tree") {
      meta.textContent = `🌳 ${copy.tree} | ${copy.cost} ${card.cost}`;
    } else {
      const orientation = card.orientation === "top_bottom" ? copy.splitVertical : copy.splitHorizontal;
      const paymentSymbols = (card.payment_symbols || [])
        .map((symbol) => forestShuffleSpeciesName(symbol, symbol, view))
        .join(", ");
      meta.textContent = `${orientation} | ${copy.payment} ${paymentSymbols}`;
    }
    node.appendChild(meta);

    if (card.kind === "tree") {
      const symbolRow = document.createElement("div");
      symbolRow.className = "forest-shuffle-symbol-row";
      symbolRow.appendChild(forestShuffleSymbolChip(card.tree_species));
      node.appendChild(symbolRow);
    } else {
      card.halves.forEach((half, halfIndex) => {
        const halfNode = document.createElement("div");
        halfNode.className = "forest-shuffle-half";
        const line = document.createElement("div");
        line.className = "forest-shuffle-half-title";
        line.textContent = `${forestShuffleSideLabel(half.slot, view)} · ${forestShuffleSpeciesName(
          half.species,
          half.name,
          view
        )} · ${copy.cost} ${half.cost}`;
        halfNode.appendChild(line);
        const line2 = document.createElement("div");
        line2.className = "forest-shuffle-symbol-row";
        line2.appendChild(forestShuffleSymbolChip(half.symbol));
        halfNode.appendChild(line2);
        halfNode.appendChild(forestShuffleTagRow(half.tags));
        if (yourTurn && pending?.type !== "raccoon") {
          const canUse = forestShufflePendingAllowsCard(view, card, half);
          const btn = forestShuffleCardButton(
            `${copy.select} ${forestShuffleSideLabel(half.slot, view)}`,
            () => {
              if (forestShuffleSelectedCardId === card.id && forestShuffleSelectedHalfIndex === halfIndex) {
                forestShuffleSelectedCardId = null;
                forestShuffleSelectedHalfIndex = null;
                forestShuffleSelectedTreeId = null;
              } else {
                forestShuffleSelectedCardId = card.id;
                forestShuffleSelectedHalfIndex = halfIndex;
                forestShuffleSelectedTreeId = null;
                forestShuffleSelectedPaymentIds.delete(card.id);
              }
              renderForestShuffleGameState({ view });
            },
            forestShuffleSelectedCardId === card.id && forestShuffleSelectedHalfIndex === halfIndex
          );
          btn.disabled = !canUse;
          halfNode.appendChild(btn);
        }
        node.appendChild(halfNode);
      });
    }

    if (pending?.type === "raccoon") {
      const toggle = forestShuffleCardButton(
        forestShuffleSelectedRaccoonIds.has(card.id) ? copy.removeFromCave : copy.markForCave,
        () => {
          if (forestShuffleSelectedRaccoonIds.has(card.id)) {
            forestShuffleSelectedRaccoonIds.delete(card.id);
          } else {
            forestShuffleSelectedRaccoonIds.add(card.id);
          }
          renderForestShuffleGameState({ view });
        },
        forestShuffleSelectedRaccoonIds.has(card.id)
      );
      node.appendChild(toggle);
    } else if (!pending && yourTurn) {
      const footer = document.createElement("div");
      footer.className = "forest-shuffle-card-actions";
      if (card.kind === "tree") {
        footer.appendChild(
          forestShuffleCardButton(
            copy.select,
            () => {
              if (forestShuffleSelectedCardId === card.id && forestShuffleSelectedHalfIndex === null) {
                forestShuffleSelectedCardId = null;
              } else {
                forestShuffleSelectedCardId = card.id;
                forestShuffleSelectedHalfIndex = null;
                forestShuffleSelectedTreeId = null;
                forestShuffleSelectedPaymentIds.delete(card.id);
              }
              renderForestShuffleGameState({ view });
            },
            forestShuffleSelectedCardId === card.id && forestShuffleSelectedHalfIndex === null
          )
        );
        footer.appendChild(
          forestShuffleCardButton(copy.sapling, () => {
            forestShuffleSelectedCardId = card.id;
            forestShuffleSelectedHalfIndex = null;
            forestShuffleSelectedTreeId = null;
            renderForestShuffleGameState({ view });
          })
        );
      }
      const payButton = forestShuffleCardButton(
        forestShuffleSelectedPaymentIds.has(card.id) ? copy.unpay : copy.pay,
        () => {
          if (forestShuffleSelectedPaymentIds.has(card.id)) {
            forestShuffleSelectedPaymentIds.delete(card.id);
          } else {
            forestShuffleSelectedPaymentIds.add(card.id);
          }
          renderForestShuffleGameState({ view });
        },
        forestShuffleSelectedPaymentIds.has(card.id)
      );
      payButton.disabled = card.id === forestShuffleSelectedCardId;
      footer.appendChild(payButton);
      node.appendChild(footer);
    }

    forestShuffleHand.appendChild(node);
  });
}

function forestShuffleRenderDrawSources(view) {
  if (!forestShuffleDrawSources) {
    return;
  }
  forestShuffleDrawSources.innerHTML = "";
  const pending = forestShufflePending(view);
  const copy = forestShuffleText(view);
  const yourTurn = forestShuffleIsYourTurn(view);
  const required = forestShuffleRequiredDrawCount(view);
  const deckBox = document.createElement("button");
  deckBox.type = "button";
  deckBox.className = "forest-shuffle-source-card";
  deckBox.textContent = `🂠 ${copy.deck} ×${forestShuffleDeckDrawCount}`;
  deckBox.disabled = !yourTurn || !!pending || required <= 0;
  deckBox.addEventListener("click", () => {
    if (forestShuffleDeckDrawCount + forestShuffleSelectedClearingIds.size >= required) {
      forestShuffleDeckDrawCount = 0;
    } else {
      forestShuffleDeckDrawCount += 1;
    }
    renderForestShuffleGameState({ view });
  });
  forestShuffleDrawSources.appendChild(deckBox);

  (view.clearing || []).forEach((card) => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "forest-shuffle-source-card";
    if (forestShuffleSelectedClearingIds.has(card.id)) {
      node.classList.add("selected");
    }
    node.disabled = !yourTurn || !!pending || required <= 0;
    node.textContent = forestShuffleCardName(card, view);
    node.addEventListener("click", () => {
      if (forestShuffleSelectedClearingIds.has(card.id)) {
        forestShuffleSelectedClearingIds.delete(card.id);
      } else if (forestShuffleDeckDrawCount + forestShuffleSelectedClearingIds.size < required) {
        forestShuffleSelectedClearingIds.add(card.id);
      }
      renderForestShuffleGameState({ view });
    });
    forestShuffleDrawSources.appendChild(node);
  });
}

function forestShuffleTreeSlot(view, player, tree, side, interactive) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "forest-shuffle-slot";
  node.dataset.forestShuffleExplain = "players";
  const cards = ((tree.slots || {})[side]) || [];
  const selectedSide = forestShuffleActiveSlot(view);
  const isSelectable = interactive && selectedSide === side;
  const title = document.createElement("div");
  title.className = "forest-shuffle-slot-label";
  title.textContent = `${forestShuffleSideLabel(side, view)} ${cards.length ? `(${cards.length})` : ""}`.trim();
  node.appendChild(title);
  const stack = document.createElement("div");
  stack.className = "forest-shuffle-slot-stack";
  if (!cards.length) {
    const empty = document.createElement("span");
    empty.className = "forest-shuffle-slot-empty";
    empty.textContent = forestShuffleText(view).empty;
    stack.appendChild(empty);
  } else {
    cards.forEach((card) => {
      const chip = document.createElement("span");
      chip.className = "forest-shuffle-slot-card";
      chip.textContent = forestShuffleSpeciesName(card.species, card.name, view);
      stack.appendChild(chip);
    });
  }
  node.appendChild(stack);
  if (interactive && selectedSide === side && player.player_id === view.you) {
    node.classList.add("selectable");
    if (forestShuffleSelectedTreeId === tree.id) {
      node.classList.add("selected");
    }
    node.addEventListener("click", () => {
      forestShuffleSelectedTreeId = forestShuffleSelectedTreeId === tree.id ? null : tree.id;
      renderForestShuffleGameState({ view });
    });
  } else {
    node.disabled = true;
  }
  return node;
}

function forestShuffleRenderPlayers(view) {
  if (!forestShufflePlayers) {
    return;
  }
  forestShufflePlayers.innerHTML = "";
  const copy = forestShuffleText(view);
  (view.players || []).forEach((player) => {
    const canTargetSlots = player.player_id === view.you && (
      (forestShuffleIsYourTurn(view) && !forestShufflePending(view)) ||
      forestShufflePending(view)?.type === "free_play"
    );
    const card = document.createElement("section");
    card.className = "forest-shuffle-player";
    if (player.player_id === view.you) {
      card.classList.add("you");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("active");
    }
    card.dataset.forestShuffleExplain = "players";

    const header = document.createElement("div");
    header.className = "forest-shuffle-player-header";
    const title = document.createElement("div");
    title.className = "forest-shuffle-player-name";
    title.textContent = `${player.name}${player.player_id === view.you ? ` (${copy.you})` : ""}`;
    header.appendChild(title);
    const stats = document.createElement("div");
    stats.className = "forest-shuffle-player-stats";
    stats.textContent = `🃏 ${player.hand_count} | 🕳️ ${player.forest.cave_count} | ⭐ ${player.score}`;
    header.appendChild(stats);
    card.appendChild(header);

    const treeWrap = document.createElement("div");
    treeWrap.className = "forest-shuffle-tree-list";
    (player.forest.trees || []).forEach((tree) => {
      const treeNode = document.createElement("article");
      treeNode.className = "forest-shuffle-tree";
      const label = document.createElement("div");
      label.className = "forest-shuffle-tree-label";
      label.textContent = tree.kind === "sapling"
        ? `🌱 ${copy.treeSapling}`
        : `🌳 ${forestShuffleSpeciesName(tree.species, tree.name, view)}`;
      treeNode.appendChild(label);
      if (tree.tree_species) {
        const symbolLine = document.createElement("div");
        symbolLine.className = "forest-shuffle-symbol-row";
        symbolLine.appendChild(forestShuffleSymbolChip(tree.tree_species));
        treeNode.appendChild(symbolLine);
      }
      const grid = document.createElement("div");
      grid.className = "forest-shuffle-tree-grid";
      grid.appendChild(document.createElement("div"));
      grid.appendChild(forestShuffleTreeSlot(view, player, tree, "top", canTargetSlots));
      grid.appendChild(document.createElement("div"));
      grid.appendChild(forestShuffleTreeSlot(view, player, tree, "left", canTargetSlots));
      const center = document.createElement("div");
      center.className = "forest-shuffle-tree-center";
      center.textContent = tree.kind === "sapling" ? "🌱" : "🌳";
      grid.appendChild(center);
      grid.appendChild(forestShuffleTreeSlot(view, player, tree, "right", canTargetSlots));
      grid.appendChild(document.createElement("div"));
      grid.appendChild(forestShuffleTreeSlot(view, player, tree, "bottom", canTargetSlots));
      grid.appendChild(document.createElement("div"));
      treeNode.appendChild(grid);
      treeWrap.appendChild(treeNode);
    });
    card.appendChild(treeWrap);

    if (view.game_over && Array.isArray(player.score_breakdown) && player.score_breakdown.length) {
      const breakdown = document.createElement("details");
      breakdown.className = "forest-shuffle-breakdown";
      const summary = document.createElement("summary");
      summary.textContent = copy.scoreBreakdown;
      breakdown.appendChild(summary);
      player.score_breakdown.forEach((item) => {
        const row = document.createElement("div");
        row.className = "forest-shuffle-breakdown-row";
        row.textContent = `${forestShuffleSpeciesName(item.species, item.name, view)}: ${item.points}`;
        breakdown.appendChild(row);
      });
      card.appendChild(breakdown);
    }

    forestShufflePlayers.appendChild(card);
  });
}

function forestShuffleRenderClearing(view) {
  if (!forestShuffleClearing) {
    return;
  }
  forestShuffleClearing.innerHTML = "";
  (view.clearing || []).forEach((card) => {
    const node = document.createElement("article");
    node.className = "forest-shuffle-card compact";
    node.dataset.forestShuffleExplain = "clearing";
    const title = document.createElement("div");
    title.className = "forest-shuffle-card-title";
    title.textContent = forestShuffleCardName(card, view);
    node.appendChild(title);
    if (card.kind === "tree") {
      const symbolRow = document.createElement("div");
      symbolRow.className = "forest-shuffle-symbol-row";
      symbolRow.appendChild(forestShuffleSymbolChip(card.tree_species));
      node.appendChild(symbolRow);
    } else if (Array.isArray(card.halves)) {
      card.halves.forEach((half) => {
        const line = document.createElement("div");
        line.className = "forest-shuffle-half-mini";
        line.textContent = `${forestShuffleSideLabel(half.slot, view)} ${forestShuffleSpeciesName(
          half.species,
          half.name,
          view
        )}`;
        node.appendChild(line);
      });
    }
    forestShuffleClearing.appendChild(node);
  });
}

function updateForestShuffleActionButtons() {
  const view = currentForestShuffleView;
  const pending = forestShufflePending(view || {});
  const yourTurn = forestShuffleIsYourTurn(view || {});
  const requiredDraws = view ? forestShuffleRequiredDrawCount(view) : 0;
  const drawCount = forestShuffleDeckDrawCount + forestShuffleSelectedClearingIds.size;
  const selectedCard = view ? forestShuffleSelectedCard(view) : null;
  const selectedHalf = view ? forestShuffleSelectedHalf(view) : null;
  const canDraw = !!view && yourTurn && !pending && requiredDraws > 0 && drawCount === requiredDraws;
  const canPlayTree = !!view && !pending && yourTurn && selectedCard && selectedCard.kind === "tree";
  const canPlaySplit = !!view && !pending && yourTurn && selectedCard && selectedCard.kind === "split" && selectedHalf && forestShuffleSelectedTreeId;
  const canFreePlaySplit = !!view && pending?.type === "free_play" && selectedCard && selectedCard.kind === "split" && selectedHalf && forestShuffleSelectedTreeId;
  const canFinishPending = !!view && pending?.type === "free_play";
  const canResolveRaccoon = !!view && pending?.type === "raccoon";
  if (forestShuffleDrawBtn) {
    forestShuffleDrawBtn.disabled = !canDraw;
  }
  if (forestShufflePlayBtn) {
    forestShufflePlayBtn.disabled = !(canPlayTree || canPlaySplit || canFreePlaySplit);
  }
  if (forestShuffleSaplingBtn) {
    forestShuffleSaplingBtn.disabled = !(canPlayTree && selectedCard);
  }
  if (forestShuffleFinishPendingBtn) {
    forestShuffleFinishPendingBtn.disabled = !canFinishPending;
  }
  if (forestShuffleResolveRaccoonBtn) {
    forestShuffleResolveRaccoonBtn.disabled = !canResolveRaccoon;
  }
}

function renderForestShuffleGameState(data) {
  const view = data.view;
  currentForestShuffleView = view;
  forestShufflePreferredLanguage = forestShuffleLanguage(view);
  if (currentGameType !== "forest_shuffle") {
    currentGameType = "forest_shuffle";
    setGamePanelVisibility("forest_shuffle");
  }
  forestShuffleSyncSelections(view);
  forestShuffleApplyStaticText(view);

  if (forestShuffleTurnLabel) {
    forestShuffleTurnLabel.textContent = forestShufflePlayerName(view, view.current_turn);
  }
  if (forestShuffleWinterLabel) {
    forestShuffleWinterLabel.textContent = `${view.winter_count}/3`;
  }
  if (forestShuffleDeckLabel) {
    forestShuffleDeckLabel.textContent = `${view.deck_count}`;
  }
  if (forestShuffleWinnerLabel) {
    forestShuffleWinnerLabel.textContent = Array.isArray(view.winner) && view.winner.length
      ? view.winner.map((playerId) => forestShufflePlayerName(view, playerId)).join(", ")
      : "-";
  }
  if (forestShuffleStatus) {
    forestShuffleStatus.textContent = view.game_over
      ? forestShuffleText(view).gameOver
      : forestShufflePendingHint(view);
  }
  if (forestShuffleActionHint) {
    forestShuffleActionHint.textContent = forestShufflePendingHint(view);
  }
  if (forestShuffleSelectionSummary) {
    forestShuffleSelectionSummary.textContent = forestShuffleSelectionText(view);
  }
  if (forestShuffleNotes) {
    forestShuffleNotes.innerHTML = "";
    (view.implementation_notes || []).forEach((note) => {
      const item = document.createElement("div");
      item.className = "forest-shuffle-note";
      const localizedNote = forestShuffleLanguage(view) === "zh" ? FOREST_SHUFFLE_NOTE_ZH[note] || note : note;
      item.textContent = `${forestShuffleText(view).note}: ${localizedNote}`;
      forestShuffleNotes.appendChild(item);
    });
  }

  forestShuffleRenderDrawSources(view);
  forestShuffleRenderClearing(view);
  forestShuffleRenderHand(view);
  forestShuffleRenderPlayers(view);
  updateForestShuffleActionButtons();
  logGameEvents(data);
  if (forestShuffleExplainMode) {
    updateForestShuffleExplainModeClasses(true);
  }
}

if (forestShuffleDrawBtn) {
  forestShuffleDrawBtn.addEventListener("click", () => {
    if (!currentForestShuffleView) {
      return;
    }
    const sources = [];
    for (let index = 0; index < forestShuffleDeckDrawCount; index += 1) {
      sources.push({ zone: "deck" });
    }
    forestShuffleSelectedClearingIds.forEach((cardId) => {
      sources.push({ zone: "clearing", card_id: cardId });
    });
    sendAction({ type: "draw_cards", sources });
    forestShuffleDeckDrawCount = 0;
    forestShuffleSelectedClearingIds = new Set();
    updateForestShuffleActionButtons();
  });
}

if (forestShufflePlayBtn) {
  forestShufflePlayBtn.addEventListener("click", () => {
    if (!currentForestShuffleView) {
      return;
    }
    const pending = forestShufflePending(currentForestShuffleView);
    const card = forestShuffleSelectedCard(currentForestShuffleView);
    if (!card) {
      log(forestShuffleLanguage() === "zh" ? "请选择一张卡牌" : "Select a card");
      return;
    }
    const action = {
      type: "play_card",
      card_id: card.id,
    };
    if (!pending) {
      action.pay_card_ids = Array.from(forestShuffleSelectedPaymentIds);
    }
    if (card.kind === "split") {
      if (!Number.isInteger(forestShuffleSelectedHalfIndex) || !forestShuffleSelectedTreeId) {
        log(forestShuffleLanguage() === "zh" ? "请选择卡牌半边和目标树木位置" : "Select a card half and target tree slot");
        return;
      }
      action.half_index = forestShuffleSelectedHalfIndex;
      action.target_tree_id = forestShuffleSelectedTreeId;
    }
    sendAction(action);
    forestShuffleSelectedCardId = null;
    forestShuffleSelectedHalfIndex = null;
    forestShuffleSelectedTreeId = null;
    forestShuffleSelectedPaymentIds = new Set();
  });
}

if (forestShuffleSaplingBtn) {
  forestShuffleSaplingBtn.addEventListener("click", () => {
    if (!currentForestShuffleView) {
      return;
    }
    const card = forestShuffleSelectedCard(currentForestShuffleView);
    if (!card) {
      log(forestShuffleLanguage() === "zh" ? "请先选择一张卡牌" : "Select a card first");
      return;
    }
    sendAction({ type: "play_card", card_id: card.id, play_as: "sapling" });
    forestShuffleSelectedCardId = null;
    forestShuffleSelectedHalfIndex = null;
    forestShuffleSelectedTreeId = null;
    forestShuffleSelectedPaymentIds = new Set();
  });
}

if (forestShuffleFinishPendingBtn) {
  forestShuffleFinishPendingBtn.addEventListener("click", () => {
    sendAction({ type: "finish_pending" });
  });
}

if (forestShuffleResolveRaccoonBtn) {
  forestShuffleResolveRaccoonBtn.addEventListener("click", () => {
    sendAction({ type: "resolve_raccoon", card_ids: Array.from(forestShuffleSelectedRaccoonIds) });
    forestShuffleSelectedRaccoonIds = new Set();
  });
}

function showForestShuffleHeaderActions(show) {
  if (forestShuffleHeaderActions) {
    forestShuffleHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitForestShuffleExplainMode();
    closeForestShuffleHelpModal();
    closeForestShuffleExplainModal();
  }
}

function showForestShuffleHelpModal() {
  if (!forestShuffleHelpModal) {
    return;
  }
  if (forestShuffleHelpContent) {
    forestShuffleHelpContent.innerHTML = forestShuffleText().helpHtml;
  }
  setModalVisible(forestShuffleHelpModal, true);
}

function closeForestShuffleHelpModal() {
  if (forestShuffleHelpModal) {
    setModalVisible(forestShuffleHelpModal, false);
  }
}

function updateForestShuffleExplainModeClasses(enabled) {
  document.querySelectorAll("[data-forest-shuffle-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
  [
    forestShuffleDrawBtn,
    forestShufflePlayBtn,
    forestShuffleSaplingBtn,
    forestShuffleFinishPendingBtn,
    forestShuffleResolveRaccoonBtn,
  ].forEach((button) => {
    if (button) {
      button.classList.toggle("has-explanation", enabled);
    }
  });
}

function toggleForestShuffleExplainMode() {
  forestShuffleExplainMode = !forestShuffleExplainMode;
  document.body.classList.toggle("forest-shuffle-explain-mode", forestShuffleExplainMode);
  updateForestShuffleExplainModeClasses(forestShuffleExplainMode);
  if (forestShuffleExplainBtn) {
    forestShuffleExplainBtn.classList.toggle("active", forestShuffleExplainMode);
  }
}

function exitForestShuffleExplainMode() {
  if (!forestShuffleExplainMode) {
    return;
  }
  forestShuffleExplainMode = false;
  document.body.classList.remove("forest-shuffle-explain-mode");
  updateForestShuffleExplainModeClasses(false);
  if (forestShuffleExplainBtn) {
    forestShuffleExplainBtn.classList.remove("active");
  }
}

function showForestShuffleExplanation(key) {
  const explanation = forestShuffleExplanation(key);
  if (!explanation || !forestShuffleExplainContent || !forestShuffleExplainModal) {
    return;
  }
  forestShuffleExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(forestShuffleExplainModal, true);
}

function closeForestShuffleExplainModal() {
  if (forestShuffleExplainModal) {
    setModalVisible(forestShuffleExplainModal, false);
  }
}

if (forestShuffleHelpBtn) {
  forestShuffleHelpBtn.addEventListener("click", showForestShuffleHelpModal);
}

if (forestShuffleHelpModalCloseBtn) {
  forestShuffleHelpModalCloseBtn.addEventListener("click", closeForestShuffleHelpModal);
}

if (forestShuffleExplainBtn) {
  forestShuffleExplainBtn.addEventListener("click", toggleForestShuffleExplainMode);
}

if (forestShuffleExplainModalCloseBtn) {
  forestShuffleExplainModalCloseBtn.addEventListener("click", closeForestShuffleExplainModal);
}

document.addEventListener("pointerdown", (event) => {
  if (!forestShuffleExplainMode) {
    return;
  }
  const explainTarget = event.target.closest("[data-forest-shuffle-explain]");
  if (explainTarget) {
    const key = explainTarget.dataset.forestShuffleExplain;
    if (key) {
      event.preventDefault();
      event.stopPropagation();
      showForestShuffleExplanation(key);
      exitForestShuffleExplainMode();
      return;
    }
  }
  const button = event.target.closest("button");
  if (
    button === forestShuffleExplainBtn ||
    button === forestShuffleHelpBtn ||
    button === forestShuffleHelpModalCloseBtn ||
    button === forestShuffleExplainModalCloseBtn
  ) {
    return;
  }
  if (button && forestShuffleExplanation(button.id)) {
    event.preventDefault();
    event.stopPropagation();
    showForestShuffleExplanation(button.id);
    exitForestShuffleExplainMode();
  }
}, true);

document.addEventListener("click", (event) => {
  if (!forestShuffleExplainMode) {
    return;
  }
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (
    button === forestShuffleExplainBtn ||
    button === forestShuffleHelpBtn ||
    button === forestShuffleHelpModalCloseBtn ||
    button === forestShuffleExplainModalCloseBtn
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && forestShuffleExplainMode) {
    exitForestShuffleExplainMode();
  }
});

window.clearForestShuffleState = clearForestShuffleState;
window.renderForestShuffleGameState = renderForestShuffleGameState;
window.showForestShuffleHeaderActions = showForestShuffleHeaderActions;
window.setForestShuffleLanguage = setForestShuffleLanguage;
