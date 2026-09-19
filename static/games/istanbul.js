(() => {
"use strict";

const istanbulGamePanel = document.getElementById("istanbulPanel");
const istanbulPhaseLabel = document.getElementById("istanbulPhase");
const istanbulTurnLabel = document.getElementById("istanbulTurn");
const istanbulMoveModeLabel = document.getElementById("istanbulMoveMode");
const istanbulWinTargetLabel = document.getElementById("istanbulWinTarget");
const istanbulTurnHint = document.getElementById("istanbulTurnHint");
const istanbulPathHint = document.getElementById("istanbulPathHint");
const istanbulBoard = document.getElementById("istanbulBoard");
const istanbulActionHint = document.getElementById("istanbulActionHint");
const istanbulActionControls = document.getElementById("istanbulActionControls");
const istanbulBonusHand = document.getElementById("istanbulBonusHand");
const istanbulPlayers = document.getElementById("istanbulPlayers");
const istanbulYou = document.getElementById("istanbulYou");
const istanbulMarkets = document.getElementById("istanbulMarkets");
const istanbulMosques = document.getElementById("istanbulMosques");
const istanbulPostOffice = document.getElementById("istanbulPostOffice");
const istanbulMarketsToggle = document.getElementById("istanbulMarketsToggle");
const istanbulMosquesToggle = document.getElementById("istanbulMosquesToggle");
const istanbulPostOfficeToggle = document.getElementById("istanbulPostOfficeToggle");
const istanbulBoardOverlays = document.getElementById("istanbulBoardOverlays");
const istanbulMarketsOverlay = document.getElementById("istanbulMarketsOverlay");
const istanbulMosquesOverlay = document.getElementById("istanbulMosquesOverlay");
const istanbulPostOfficeOverlay = document.getElementById("istanbulPostOfficeOverlay");

const istanbulHeaderActions = document.getElementById("istanbulHeaderActions");
const istanbulHelpBtn = document.getElementById("istanbulHelpBtn");
const istanbulExplainBtn = document.getElementById("istanbulExplainBtn");
const istanbulHelpModal = document.getElementById("istanbulHelpModal");
const istanbulHelpModalCloseBtn = document.getElementById("istanbulHelpModalCloseBtn");
const istanbulHelpContent = document.getElementById("istanbulHelpContent");
const istanbulExplainModal = document.getElementById("istanbulExplainModal");
const istanbulExplainModalCloseBtn = document.getElementById("istanbulExplainModalCloseBtn");
const istanbulExplainContent = document.getElementById("istanbulExplainContent");

const GOODS = ["red", "green", "yellow", "blue"];
const GOOD_LABELS = {
  red: "🔴",
  green: "🟢",
  yellow: "🟡",
  blue: "🔵",
};

const ISTANBUL_BONUS_INFO = {
    BC_GOOD: ["🎴 获取货物", "立即选择获得 1 件货物（🔴 布料／🟢 香料／🟡 水果／🔵 珠宝），不能超过容量。"],
    BC_LIRA5: ["💰 获得 5 里拉", "立即获得 5 里拉。可在移动、助手或地点行动前使用。"],
    BC_SULTAN_2X: ["💎 宫殿双倍行动", "在 #13 苏丹宫殿行动前使用：连续购买两颗红宝石，每次支付当时的货物费用；只在付得起时进行第二次。"],
    BC_POST_2X: ["📮 邮局双倍行动", "在 #5 邮局行动前使用：连续领取当前及下一行资源，并推进两行。"],
    BC_GEM_2X: ["💎 宝石商双倍行动", "在 #14 宝石商行动前使用：连续买两颗红宝石，每颗都需支付当前价格；钱不足则只买一颗。"],
    BC_FAMILY_POLICE_REWARD: ["👪 家族返回警察局", "家族在外时将其送回警察局，选择 1 张奖励卡或 3 里拉作为奖励。"],
    BC_NO_MOVE: ["🧭 原地行动", "移动前使用，本回合停在原地。仍需确认移动，再处理助手与地点行动。"],
    BC_MOVE_3_4: ["🧭 移动 3–4 格", "移动前使用，将本回合移动距离改为 3–4 格。不能回到起点。"],
    BC_RETURN_ASSISTANT: ["👥 召回助手", "移动前使用，免费将棋盘上自己的 1 名助手召回队伍。"],
    BC_SMALL_MARKET_WILD: ["🛒 小市场通配", "在 #11 小市场行动前使用，本次可出售任意颜色货物，最多 5 件。"],
};
const BONUS_LABELS = Object.fromEntries(Object.entries(ISTANBUL_BONUS_INFO).map(([key, value]) => [key, value[0]]));

const PLAYER_COLORS = ["#d97706", "#0f766e", "#b91c1c", "#2563eb", "#7c3aed"];

const ISTANBUL_HELP_TEXT = `
<h3>先记住：补货 → 卖货 → 换红宝石</h3>
<p>你是集市中的商人。收集 💎 红宝石：2 人局目标 6 颗，3–5 人局 5 颗。有人达标后，其余玩家各完成最后一次回合；比较红宝石，平手依次比较里拉、货物总数、奖励卡数量。</p>
<h3>每回合跟着 3 步走</h3>
<ol>
<li><strong>选择地点。</strong>通常沿上下左右走 1–2 格，不能回到起点。轻点高亮地点查看路线、效果和费用，再点 Move 确认。沿途地点不执行行动。</li>
<li><strong>安排助手。</strong>目的地有自己的助手就收回；没有则放下随行的 1 名助手，然后才可执行地点行动。没有助手可用时会跳过地点行动；去喷泉召回助手。</li>
<li><strong>执行地点行动。</strong>仓库补货、市场卖货、宝石商买宝石。按提示完成选择；行动及相遇处理结束后自动轮到下一位。</li>
</ol>
<h3>第一次可以这样玩</h3>
<p>先找能到达的布料／香料／水果仓库补货，再看 Markets 的需求，到市场换钱，最后到宝石商买红宝石。货物也能在苏丹宫殿换宝石。先查看目的地当前费用，避免白跑。</p>
<h3>看懂你的资源</h3>
<p>💰 里拉是钱；💎 红宝石决定胜负；📦 手推车容量是<strong>每种颜色</strong>货物的上限；👥 是随行助手。🔴 布料、🟢 香料、🟡 水果、🔵 珠宝可以出售或支付。悬停、键盘聚焦或轻点资源徽标可直接查看说明。</p>
<h3>地图上的人</h3>
<p>姓名首字代表商人，👥 代表留在该地的助手，👪 代表家族成员。抵达有其他商人的地点，每人支付 2 里拉（喷泉免费）；钱不够则本回合直接结束。助手颜色与主人一致，ⓘ 可查看完整名单。</p>
<p>行动后遇到别人的家族成员，可选 1 张奖励卡或 3 里拉，将其送回警察局；若对方有黄色清真寺板块，对方另获 2 里拉。遇到 🎩 总督可用 2 里拉或 1 张奖励卡换 1 张卡；遇到 🕵️ 走私者可用 2 里拉或 1 件货物换 1 件货物，也可 Skip。</p>
<h3>其他获取宝石的方式</h3>
<p>苏丹宫殿支付指定货物；宝石商支付里拉，价格会逐次上涨。先将手推车容量升到 5 的玩家获得 1 颗宝石。集齐同一座清真寺的两色板块，且该处仍有宝石时，获得 1 颗。</p>
<h3>特殊地点与奖励卡</h3>
<p>喷泉可召回助手（不勾选时全部召回）。黑市先选择 1 件基础货物，再掷骰获取蓝色珠宝。茶馆报 3–12：骰子总和达到所报数就获得该数额里拉，否则只得 2 里拉。警察局可派出自己的家族成员去执行另一个地点的行动，不触发相遇。</p>
<p>奖励卡是可选操作，点卡后再点 Play Bonus。改变移动的卡要在移动前使用，双倍行动卡要在对应地点行动前使用。红色清真寺能力：付 2 里拉召回 1 名助手；绿色：掷骰后付 2 里拉重掷或加 1；黄色：家族被送回时获 2 里拉；蓝色：获得时增加 1 名助手（总数最多 5）。</p>
<h3>Controls</h3>
<p>Help 查看规则，Explain 后点控件查看解释（灰色按钮也可以）。ⓘ 只查看说明，不执行行动。点击空白或按 Esc 取消选择；弹窗可用 Close、Esc 或点击背景关闭。手机提示在轻点后显示 3 秒，再次轻点会更新并重新计时。</p>
`;

const ISTANBUL_PLACES = {
  1: ["车匠", "升级货车", "支付 7 里拉，将每色货物容量增加 1（最多 5）。首位升到 5 的玩家获得 1 颗红宝石。"],
  2: ["布料仓库", "补满布料", "免费将红色布料补到手推车容量上限。"],
  3: ["香料仓库", "补满香料", "免费将绿色香料补到手推车容量上限。"],
  4: ["水果仓库", "补满水果", "免费将黄色水果补到手推车容量上限。"],
  5: ["邮局", "领取资源", "免费领取邮局当前一行的钱与货物，然后推进到下一行。"],
  6: ["商队旅馆", "抽二弃一", "抽 2 张奖励卡，再从手牌中选择 1 张弃掉。"],
  7: ["喷泉", "召回助手", "免费召回棋盘上的助手；不选择时召回全部。这里不向其他商人付费。"],
  8: ["黑市", "货物＋骰子", "选择 1 件布料、香料或水果，再掷骰获取蓝色珠宝：7–8 得 1 件，9–10 得 2 件，11–12 得 3 件。"],
  9: ["茶馆", "掷骰赚钱", "报 3–12，掷骰总和达到所报数字就获得该数额里拉，否则获得 2 里拉。"],
  10: ["大市场", "卖货赚钱", "出售 1–5 件符合当前需求的货物，按出售件数获得里拉。需求会在交易后更新。"],
  11: ["小市场", "卖货赚钱", "出售 1–5 件符合当前需求的货物，按出售件数获得里拉。通配奖励卡可放宽颜色限制。"],
  12: ["警察局", "派出家族", "家族成员在警察局时，可派往其他地点并执行该地点行动，无需助手且不触发相遇。"],
  13: ["苏丹宫殿", "货物换宝石", "支付当前要求的货物，换取 1 颗红宝石。下一颗的要求会增加。"],
  14: ["宝石商", "里拉买宝石", "支付当前标价的里拉，购买 1 颗红宝石。下一颗会涨价。"],
  15: ["小清真寺", "红绿能力", "支付 1 件布料或香料，获得对应的可用板块及能力。集齐两色且宝石池未空时，获得 1 颗红宝石。"],
  16: ["大清真寺", "黄蓝能力", "支付 1 件水果或珠宝，获得对应的可用板块及能力。集齐两色且宝石池未空时，获得 1 颗红宝石。"],
};
const ISTANBUL_GOOD_NAMES = { red: "布料", green: "香料", yellow: "水果", blue: "珠宝" };
const ISTANBUL_GOOD_HELP = "货物用于市场出售或支付地点费用，数量单位为件，每种颜色各自受手推车容量限制。";

const ISTANBUL_MOSQUE_ABILITIES = {
  small: [
    "🔴: return 1 assistant for 2💰",
    "🟢: reroll or +1 for 2💰 after 🎲",
    "Set bonus: 🔴+🟢 => +💎",
  ],
  great: [
    "🟡: +2💰 on Police reward",
    "🔵: +1 assistant when taken (<5)",
    "Set bonus: 🟡+🔵 => +💎",
  ],
};

let currentIstanbulView = null;
let istanbulExplainMode = false;
let istanbulLastPhase = null;
let istanbulLastTurn = null;
let istanbulLastMoveMode = null;
let istanbulActiveOverlay = null;
let istanbulInspectedPos = null;
let istanbulHints = null;

const istanbulSelections = {
  path: [],
  bonusCardId: null,
  bonusGood: "red",
  bonusAssistant: null,
  bonusRewardChoice: "card",
  marketGoods: { red: 0, green: 0, yellow: 0, blue: 0 },
  blackGood: "red",
  teaTarget: 7,
  mosqueColor: "red",
  familyDestination: null,
  smugglerGood: "red",
  smugglerPayment: "lira",
  governorPayment: "lira",
  rewardChoice: "card",
  caravanDiscard: null,
  fountainReturns: new Set(),
};

function resetIstanbulSelections() {
  istanbulSelections.path = [];
  istanbulSelections.bonusCardId = null;
  istanbulSelections.bonusGood = "red";
  istanbulSelections.bonusAssistant = null;
  istanbulSelections.bonusRewardChoice = "card";
  istanbulSelections.marketGoods = { red: 0, green: 0, yellow: 0, blue: 0 };
  istanbulSelections.blackGood = "red";
  istanbulSelections.teaTarget = 7;
  istanbulSelections.mosqueColor = "red";
  istanbulSelections.familyDestination = null;
  istanbulSelections.smugglerGood = "red";
  istanbulSelections.smugglerPayment = "lira";
  istanbulSelections.governorPayment = "lira";
  istanbulSelections.rewardChoice = "card";
  istanbulSelections.caravanDiscard = null;
  istanbulSelections.fountainReturns = new Set();
}

const ISTANBUL_OVERLAYS = {
  markets: { button: istanbulMarketsToggle, panel: istanbulMarketsOverlay },
  mosques: { button: istanbulMosquesToggle, panel: istanbulMosquesOverlay },
  post: { button: istanbulPostOfficeToggle, panel: istanbulPostOfficeOverlay },
};

function setIstanbulOverlay(name) {
  if (!istanbulBoardOverlays) return;
  const next = name || null;
  istanbulActiveOverlay = next;
  const isOpen = Boolean(next);
  istanbulBoardOverlays.classList.toggle("hidden", !isOpen);
  istanbulBoardOverlays.setAttribute("aria-hidden", (!isOpen).toString());
  Object.entries(ISTANBUL_OVERLAYS).forEach(([key, entry]) => {
    const show = key === next;
    if (entry.panel) entry.panel.classList.toggle("hidden", !show);
    if (entry.button) {
      entry.button.classList.toggle("active", show);
      entry.button.setAttribute("aria-expanded", show.toString());
    }
  });
}

function toggleIstanbulOverlay(name) {
  if (!istanbulBoardOverlays) return;
  if (istanbulActiveOverlay === name) {
    setIstanbulOverlay(null);
    return;
  }
  setIstanbulOverlay(name);
}

function closeIstanbulOverlays() {
  if (!istanbulActiveOverlay) return false;
  setIstanbulOverlay(null);
  return true;
}

function clearIstanbulState() {
  currentIstanbulView = null;
  istanbulInspectedPos = null;
  istanbulHints?.hide();
  exitIstanbulExplainMode();
  closeIstanbulHelpModal();
  closeIstanbulExplainModal();
  istanbulLastPhase = null;
  istanbulLastTurn = null;
  istanbulLastMoveMode = null;
  resetIstanbulSelections();
  closeIstanbulOverlays();
  document.getElementById("istanbulGuide")?.replaceChildren();
  document.getElementById("istanbulDestination")?.replaceChildren();
  if (istanbulPhaseLabel) istanbulPhaseLabel.textContent = "-";
  if (istanbulTurnLabel) istanbulTurnLabel.textContent = "-";
  if (istanbulMoveModeLabel) istanbulMoveModeLabel.textContent = "-";
  if (istanbulWinTargetLabel) istanbulWinTargetLabel.textContent = "-";
  if (istanbulTurnHint) istanbulTurnHint.textContent = "-";
  if (istanbulPathHint) istanbulPathHint.textContent = "";
  if (istanbulBoard) istanbulBoard.innerHTML = "";
  if (istanbulActionHint) istanbulActionHint.textContent = "-";
  if (istanbulActionControls) istanbulActionControls.innerHTML = "";
  if (istanbulBonusHand) istanbulBonusHand.innerHTML = "";
  if (istanbulPlayers) istanbulPlayers.innerHTML = "";
  if (istanbulYou) istanbulYou.innerHTML = "";
  if (istanbulMarkets) istanbulMarkets.innerHTML = "";
  if (istanbulMosques) istanbulMosques.innerHTML = "";
  if (istanbulPostOffice) istanbulPostOffice.innerHTML = "";
}

function showIstanbulHeaderActions(show) {
  if (!show) { istanbulHints?.hide(); exitIstanbulExplainMode(); closeIstanbulHelpModal(); closeIstanbulExplainModal(); }
  if (istanbulHeaderActions) {
    istanbulHeaderActions.style.display = show ? "flex" : "none";
  }
}

function showIstanbulHelpModal() {
  if (!istanbulHelpModal || !istanbulHelpContent) return;
  istanbulHints?.hide();
  exitIstanbulExplainMode();
  istanbulHelpContent.innerHTML = ISTANBUL_HELP_TEXT;
  setModalVisible(istanbulHelpModal, true);
}

function closeIstanbulHelpModal() {
  if (!istanbulHelpModal) return;
  setModalVisible(istanbulHelpModal, false);
}

function updateIstanbulExplainClasses(enabled) {
    istanbulGamePanel?.querySelectorAll("[data-istanbul-explain], [data-istanbul-tip]").forEach(node => node.classList.toggle("has-explanation", enabled));
}

function toggleIstanbulExplainMode() {
  istanbulHints?.hide();
  istanbulExplainMode = !istanbulExplainMode;
  document.body.classList.toggle("istanbul-explain-mode", istanbulExplainMode);
  updateIstanbulExplainClasses(istanbulExplainMode);
  if (istanbulExplainBtn) {
    istanbulExplainBtn.classList.toggle("active", istanbulExplainMode);
    istanbulExplainBtn.setAttribute("aria-pressed", String(istanbulExplainMode));
  }
}

function exitIstanbulExplainMode() {
  if (!istanbulExplainMode) return;
  istanbulExplainMode = false;
  document.body.classList.remove("istanbul-explain-mode");
  updateIstanbulExplainClasses(false);
  if (istanbulExplainBtn) {
    istanbulExplainBtn.classList.remove("active");
    istanbulExplainBtn.setAttribute("aria-pressed", "false");
  }
}

function closeIstanbulExplainModal() {
  if (!istanbulExplainModal) return;
  setModalVisible(istanbulExplainModal, false);
}

function getViewer(view) {
  if (!view || !view.you || !Array.isArray(view.players)) return null;
  return view.players.find((p) => p.player_id === view.you) || null;
}

function formatPlayerName(view, playerId) {
  if (!playerId) return "-";
  const players = Array.isArray(view.players) ? view.players : [];
  const match = players.find((p) => p.player_id === playerId);
  return match && match.name ? match.name : playerId;
}

function getTileByPos(view, pos) {
  return (view.board || []).find((t) => t.pos === pos) || null;
}

function getTileByPlaceId(view, placeId) {
  return (view.board || []).find((t) => t.place_id === placeId) || null;
}

function buildNeighborMap(view) {
  const neighbors = new Map();
  (view.board || []).forEach((tile) => {
    neighbors.set(tile.pos, []);
  });
  (view.board || []).forEach((tile) => {
    const candidates = [
      { r: tile.row - 1, c: tile.col },
      { r: tile.row + 1, c: tile.col },
      { r: tile.row, c: tile.col - 1 },
      { r: tile.row, c: tile.col + 1 },
    ];
    candidates.forEach((coord) => {
      const match = (view.board || []).find((t) => t.row === coord.r && t.col === coord.c);
      if (match) {
        neighbors.get(tile.pos).push(match.pos);
      }
    });
  });
  return neighbors;
}

function selectionIsViewerTurn(view) {
  return view && view.current_player === view.you;
}

function formatGoodsLine(goods) {
  return GOODS.map((color) => {
    const count = goods[color] || 0;
    return `${GOOD_LABELS[color]}${ISTANBUL_GOOD_NAMES[color]} ${count}`;
  }).join(" ");
}

function clampMarketGoods(view, required, allowWild) {
  const viewer = getViewer(view);
  if (!viewer) return;
  GOODS.forEach((color) => {
    const maxByGoods = viewer.goods[color] || 0;
    const maxByReq = required ? required[color] || 0 : maxByGoods;
    const limit = allowWild ? maxByGoods : Math.min(maxByGoods, maxByReq);
    istanbulSelections.marketGoods[color] = Math.min(istanbulSelections.marketGoods[color], limit);
  });
  let total = GOODS.reduce((sum, color) => sum + (istanbulSelections.marketGoods[color] || 0), 0);
  if (total > 5) {
    let overflow = total - 5;
    for (const color of GOODS) {
      if (overflow <= 0) break;
      const current = istanbulSelections.marketGoods[color];
      if (current > 0) {
        const reduce = Math.min(current, overflow);
        istanbulSelections.marketGoods[color] -= reduce;
        overflow -= reduce;
      }
    }
  }
}

function clearSelectionIfNeeded(view) {
  if (!view) return;
  if (istanbulLastMoveMode !== view.movement_mode) {
    istanbulSelections.path = [];
    istanbulInspectedPos = null;
  }
  istanbulLastMoveMode = view.movement_mode;
  if (istanbulLastPhase && istanbulLastPhase !== view.phase) {
    istanbulInspectedPos = null;
    istanbulSelections.path = [];
    istanbulSelections.familyDestination = null;
    istanbulSelections.fountainReturns = new Set();
  }
  if (istanbulLastTurn && istanbulLastTurn !== view.current_player) {
    istanbulSelections.path = [];
    istanbulSelections.familyDestination = null;
    istanbulSelections.bonusCardId = null;
    istanbulSelections.fountainReturns = new Set();
  }
  istanbulLastPhase = view.phase;
  istanbulLastTurn = view.current_player;
}

function appendActionNote(text) {
  if (!istanbulActionControls || !text) return;
  const note = document.createElement("div");
  note.className = "istanbul-action-note";
  note.textContent = text;
  istanbulActionControls.appendChild(note);
}

function canPaySultanCost(goods, cost) {
  if (!cost || !goods) return false;
  let surplus = 0;
  for (const color of GOODS) {
    const need = cost[color] || 0;
    const have = goods[color] || 0;
    if (have < need) return false;
    surplus += have - need;
  }
  return surplus >= (cost.any || 0);
}

function formatSultanCost(cost) {
  if (!cost) return "";
  const parts = [];
  GOODS.forEach((color) => {
    if (cost[color]) {
      parts.push(`${GOOD_LABELS[color]}${ISTANBUL_GOOD_NAMES[color]} ${cost[color]}`);
    }
  });
  if (cost.any) {
    parts.push(`任意货物 ${cost.any} 件`);
  }
  return parts.join(" ");
}

function renderIstanbulGameState(data) {
  const view = data.view || {};
  const focus = document.activeElement;
  const focusId = istanbulGamePanel?.contains(focus) ? focus.id : null;
  currentIstanbulView = view;
  clearSelectionIfNeeded(view);
  if (istanbulPhaseLabel) istanbulPhaseLabel.textContent = ({movement:"选择地点", assistant:"安排助手", action:"地点行动", encounters:"处理相遇", game_over:"游戏结束"})[view.phase] || "等待";
  if (istanbulTurnLabel) istanbulTurnLabel.textContent = formatPlayerName(view, view.current_player);
  if (istanbulMoveModeLabel) istanbulMoveModeLabel.textContent = ({normal:"1–2 格", long:"3–4 格", stay:"原地"})[view.movement_mode] || "—";
  if (istanbulWinTargetLabel) istanbulWinTargetLabel.textContent = `💎 ${view.rubies_to_win || "—"}`;
  if (istanbulTurnHint) {
    istanbulTurnHint.textContent = selectionIsViewerTurn(view) ? "Your turn" : "Waiting";
  }
  renderIstanbulBoard(view);
  renderIstanbulPlayers(view);
  renderIstanbulYou(view);
  renderIstanbulMarkets(view);
  renderIstanbulMosques(view);
  renderIstanbulPostOffice(view);
  renderIstanbulBonus(view);
  const bonusSummary = istanbulBonusHand?.closest("details")?.querySelector("summary");
  if (bonusSummary) bonusSummary.textContent = `Bonus Cards (${getViewer(view)?.bonus_hand?.length || 0})`;
  renderIstanbulActionCenter(view);
  renderIstanbulGuide(view);
  renderIstanbulDestination(view);
  decorateIstanbulHints(view);
  updateIstanbulExplainClasses(istanbulExplainMode);
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

function renderIstanbulBoard(view) {
  if (!istanbulBoard) return;
  istanbulBoard.replaceChildren();
  const viewer = getViewer(view);
  const routes = istanbulReachableRoutes(view);
  const selected = istanbulSelections.path.at(-1);
  const isMoving = selectionIsViewerTurn(view) && view.phase === "movement" && !view.pending;
  const police = viewer && getTileByPos(view, viewer.merchant_pos)?.place_id === 12;
  const isFamily = selectionIsViewerTurn(view) && view.phase === "action" && !view.pending && police && viewer.family_pos === viewer.merchant_pos;
  const board = [...(view.board || [])].sort((a,b) => a.row-b.row || a.col-b.col);
  board.forEach(tile => {
    const shell = document.createElement("div");
    shell.className = "istanbul-tile-shell";
    const here = viewer?.merchant_pos === tile.pos;
    const chosen = selected === tile.pos || istanbulSelections.familyDestination === tile.pos;
    shell.classList.toggle("current", here);
    shell.classList.toggle("reachable", isMoving && routes.has(tile.pos));
    shell.classList.toggle("selected", chosen);
    const tileEl = document.createElement("button");
    tileEl.type = "button";
    tileEl.className = "istanbul-tile";
    tileEl.id = `istanbulTile${tile.pos}`;
    tileEl.dataset.pos = tile.pos;
    tileEl.dataset.placeId = tile.place_id;
    tileEl.dataset.istanbulExplain = istanbulPlaceInfo(view, tile);
    tileEl.setAttribute("aria-pressed", String(chosen));
    tileEl.setAttribute("aria-label", `${istanbulPlaceName(tile)}。${here ? "你的商人在这里。" : ""}${routes.has(tile.pos) && isMoving ? `${routes.get(tile.pos).length} 格可达。` : ""}${ISTANBUL_PLACES[tile.place_id]?.[1] || ""}`);
    const header = document.createElement("span");
    header.className = "istanbul-tile-header";
    header.textContent = `#${tile.place_id} ${here ? "· 你在这" : chosen ? "· 已选" : isMoving && routes.has(tile.pos) ? `· ${routes.get(tile.pos).length} 格` : ""}`;
    const name = document.createElement("span");
    name.className = "istanbul-tile-name";
    name.textContent = istanbulPlaceName(tile);
    const desc = document.createElement("span");
    desc.className = "istanbul-tile-desc";
    desc.textContent = ISTANBUL_PLACES[tile.place_id]?.[1] || "";
    let infoSuffix = "";
    const tokens = document.createElement("span");
    tokens.className = "istanbul-token-row";
    [...(view.players || [])].sort((a,b) => Number(b.player_id === view.you) - Number(a.player_id === view.you)).forEach(player => {
      const append = (text, extra) => {
        const token = document.createElement("span");
        token.className = `istanbul-token ${extra}`;
        token.style.background = PLAYER_COLORS[(player.seat || 0) % PLAYER_COLORS.length];
        token.textContent = text;
        tokens.append(token);
      };
      if (player.merchant_pos === tile.pos) append(Array.from(player.name || "P")[0], "");
      if ((player.assistants_on_board || []).includes(tile.pos)) append("👥", "assistant");
      if (player.family_pos === tile.pos) append("👪", "family");
    });
    for (const [npc, icon] of [["governor", "🎩"], ["smuggler", "🕵️"]]) {
      if (view.npc?.[npc] !== tile.pos) continue;
      const token = document.createElement("span");
      token.className = "istanbul-token npc";
      token.textContent = icon;
      tokens.append(token);
    }
    if (tokens.children.length > 2) {
      const extra = tokens.children.length - 1;
      while (tokens.children.length > 1) tokens.lastChild.remove();
      const count = document.createElement("span");
      count.className = "istanbul-token extra";
      count.textContent = `+${extra}`;
      tokens.append(count);
      infoSuffix = `另有 ${extra} 个棋子，ⓘ 查看完整名单。`;
    }
    tileEl.append(header, name, desc, tokens);
    tileEl.addEventListener("click", () => {
      istanbulInspectedPos = tile.pos;
      if (isMoving && routes.has(tile.pos)) {
        istanbulSelections.path = selected === tile.pos ? [] : routes.get(tile.pos);
      } else if (isFamily && tile.place_id !== 12) {
        istanbulSelections.familyDestination = istanbulSelections.familyDestination === tile.pos ? null : tile.pos;
      }
      renderIstanbulGameState({ view });
    });
    const info = document.createElement("button");
    info.type = "button";
    info.className = "istanbul-tile-info";
    info.id = `istanbulTileInfo${tile.pos}`;
    info.textContent = "ⓘ";
    info.dataset.istanbulTip = `${infoSuffix}${istanbulPlaceInfo(view, tile)}`;
    info.setAttribute("aria-label", `${istanbulPlaceName(tile)}：地点与棋子说明`);
    shell.append(tileEl, info);
    istanbulBoard.append(shell);
  });
}

function istanbulReachableRoutes(view) {
  const viewer = getViewer(view);
  const routes = new Map();
  if (!viewer) return routes;
  const start = viewer.merchant_pos;
  const limits = movementLimits(view.movement_mode || "normal");
  const neighbors = buildNeighborMap(view);
  const queue = [{pos: start, path: []}];
  while (queue.length) {
    const {pos, path} = queue.shift();
    if (path.length >= limits.min && (pos !== start || limits.max === 0) && !routes.has(pos)) routes.set(pos, path);
    if (path.length >= limits.max) continue;
    for (const next of neighbors.get(pos) || []) queue.push({pos: next, path: [...path, next]});
  }
  return routes;
}

function renderIstanbulPlayers(view) {
  if (!istanbulPlayers) return;
  istanbulPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const row = document.createElement("div");
    row.className = "istanbul-player-row";
    if (player.player_id === view.current_player) {
      row.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "istanbul-player-name";
    const nameLabel = player.name || player.player_id;
    name.textContent = player.player_id === view.you ? `${nameLabel} (You)` : nameLabel;
    row.appendChild(name);

    const stats = document.createElement("div");
    stats.textContent = `Lira💰 ${player.lira} | Rubies💎 ${player.rubies} | Cart📦 ${player.capacity}`;
    row.appendChild(stats);

    const goods = document.createElement("div");
    goods.textContent = formatGoodsLine(player.goods || {});
    row.appendChild(goods);

    const assistants = document.createElement("div");
    assistants.textContent = `Assistants👥: ${player.assistants_in_stack} in stack, ${player.assistants_on_board.length} on board`;
    row.appendChild(assistants);

    istanbulPlayers.appendChild(row);
  });
}

function renderIstanbulYou(view) {
  if (!istanbulYou) return;
  istanbulYou.replaceChildren();
  const viewer = getViewer(view);
  if (!viewer) { istanbulYou.textContent = "Spectating"; return; }
  const badges = [
    [`💰 ${viewer.lira}`, `里拉：${viewer.lira}。用于购买红宝石、升级货车或支付相遇费用。`],
    [`💎 ${viewer.rubies}/${view.rubies_to_win}`, `红宝石：已得 ${viewer.rubies} 颗，目标 ${view.rubies_to_win} 颗。有人达标后进入最后一轮，最终数量最多者胜。`],
    [`📦 ${viewer.capacity}`, `手推车容量：每种颜色最多存放 ${viewer.capacity} 件货物；车匠可付费升级至 5。`],
    [`👥 ${viewer.assistants_in_stack}`, `随行助手：${viewer.assistants_in_stack} 名；留在棋盘上 ${viewer.assistants_on_board.length} 名。放下或收回一名助手才能执行地点行动；喷泉可召回。`],
    ...GOODS.map(color => [`${GOOD_LABELS[color]} ${viewer.goods[color] || 0}`, `${ISTANBUL_GOOD_NAMES[color]}：${viewer.goods[color] || 0} 件。${ISTANBUL_GOOD_HELP}`]),
  ];
  badges.forEach(([label, tip]) => {
    const badge = document.createElement("span");
    badge.className = "istanbul-pill";
    badge.textContent = label;
    badge.dataset.istanbulTip = tip;
    istanbulYou.append(badge);
  });
}

function renderIstanbulMarkets(view) {
  if (!istanbulMarkets) return;
  istanbulMarkets.innerHTML = "";

  const markets = [
    { key: "market_small", label: "Small Market" },
    { key: "market_large", label: "Large Market" },
  ];

  markets.forEach((market) => {
    const card = document.createElement("div");
    card.className = "istanbul-market-card";
    const title = document.createElement("div");
    title.className = "istanbul-market-title";
    title.textContent = market.label;
    card.appendChild(title);

    const current = view[market.key] && view[market.key].current ? view[market.key].current : null;
    if (current) {
      const req = document.createElement("div");
      req.textContent = `Demand: ${formatGoodsLine(current.goods || {})}`;
      card.appendChild(req);
    } else {
      const empty = document.createElement("div");
      empty.textContent = "No demand tiles";
      card.appendChild(empty);
    }

    const revenueTable = view.market_revenue && view.market_revenue[market.key.includes("small") ? "small" : "large"];
    if (revenueTable) {
      const table = document.createElement("div");
      table.className = "istanbul-mini-table";
      Object.keys(revenueTable)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((count) => {
          const cell = document.createElement("span");
          cell.textContent = `${count} => ${revenueTable[count]}`;
          table.appendChild(cell);
        });
      card.appendChild(table);
    }
    istanbulMarkets.appendChild(card);
  });
}

function renderIstanbulMosques(view) {
  if (!istanbulMosques) return;
  istanbulMosques.innerHTML = "";
  const mosques = view.mosques;
  if (!mosques) {
    istanbulMosques.textContent = "Mosques unavailable.";
    return;
  }

  const viewer = getViewer(view);
  const owned = viewer && viewer.mosque_tiles ? viewer.mosque_tiles : {};
  const groups = [
    { key: "small", label: "Small", colors: ["red", "green"] },
    { key: "great", label: "Great", colors: ["yellow", "blue"] },
  ];

  groups.forEach((group) => {
    const data = mosques[group.key] || {};
    const row = document.createElement("div");
    row.className = "istanbul-mosque-row";

    const header = document.createElement("div");
    header.className = "istanbul-mosque-header";
    const title = document.createElement("div");
    title.textContent = `${group.label} 🕌`;
    const rubies = document.createElement("div");
    rubies.textContent = `💎 ${data.rubies ?? 0}`;
    rubies.className = "istanbul-mosque-rubies";
    rubies.dataset.mosque = group.key;
    header.appendChild(title);
    header.appendChild(rubies);
    row.appendChild(header);

    const available = document.createElement("div");
    available.className = "istanbul-mosque-tiles";
    const availableLabel = document.createElement("span");
    availableLabel.className = "istanbul-mosque-label";
    availableLabel.textContent = "Available:";
    available.appendChild(availableLabel);
    group.colors.forEach((color) => {
      const tile = document.createElement("span");
      tile.className = "istanbul-mosque-tile";
      tile.textContent = GOOD_LABELS[color];
      if (!data[color]) {
        tile.classList.add("taken");
      }
      available.appendChild(tile);
    });
    row.appendChild(available);

    if (viewer) {
      const youRow = document.createElement("div");
      youRow.className = "istanbul-mosque-tiles istanbul-mosque-you";
      const youLabel = document.createElement("span");
      youLabel.className = "istanbul-mosque-label";
      youLabel.textContent = "You:";
      youRow.appendChild(youLabel);
      group.colors.forEach((color) => {
        const tile = document.createElement("span");
        tile.className = "istanbul-mosque-tile";
        tile.textContent = GOOD_LABELS[color];
        if (owned[color]) {
          tile.classList.add("owned");
        } else {
          tile.classList.add("taken");
        }
        youRow.appendChild(tile);
      });
      row.appendChild(youRow);
    }

    const abilities = document.createElement("div");
    abilities.className = "istanbul-mosque-abilities";
    const lines = ISTANBUL_MOSQUE_ABILITIES[group.key] || [];
    lines.forEach((line) => {
      const item = document.createElement("div");
      item.className = "istanbul-mosque-ability";
      item.textContent = line;
      abilities.appendChild(item);
    });
    row.appendChild(abilities);

    istanbulMosques.appendChild(row);
  });
}

function renderIstanbulPostOffice(view) {
  if (!istanbulPostOffice) return;
  istanbulPostOffice.innerHTML = "";
  const rows = Array.isArray(view.post_office_rows) ? view.post_office_rows : [];
  if (!rows.length) {
    istanbulPostOffice.textContent = "Track unavailable.";
    return;
  }
  const current = Number.isInteger(view.post_office_index) ? view.post_office_index : 0;
  const track = document.createElement("div");
  track.className = "istanbul-post-track";
  rows.forEach((row, idx) => {
    const line = document.createElement("div");
    line.className = "istanbul-post-row";
    if (idx === current) {
      line.classList.add("current");
    }
    const indicator = document.createElement("div");
    indicator.className = "istanbul-post-indicator";
    indicator.textContent = idx === current ? "📬" : "·";
    line.appendChild(indicator);

    const rowLabel = document.createElement("div");
    rowLabel.className = "istanbul-post-label";
    rowLabel.textContent = `Row ${idx + 1}`;
    line.appendChild(rowLabel);

    const items = document.createElement("div");
    items.className = "istanbul-post-items";
    (row || []).forEach((item) => {
      const span = document.createElement("span");
      span.className = "istanbul-post-item";
      if (typeof item === "string" && item.startsWith("coin")) {
        const value = parseInt(item.replace("coin", ""), 10);
        span.textContent = `+${Number.isInteger(value) ? value : 1}💰`;
      } else if (GOOD_LABELS[item]) {
        span.textContent = `+${GOOD_LABELS[item]}`;
      } else {
        span.textContent = String(item);
      }
      items.appendChild(span);
    });
    line.appendChild(items);
    track.appendChild(line);
  });
  istanbulPostOffice.appendChild(track);
}

function renderIstanbulBonus(view) {
  if (!istanbulBonusHand) return;
  istanbulBonusHand.innerHTML = "";
  const viewer = getViewer(view);
  if (!viewer || !Array.isArray(viewer.bonus_hand)) {
    istanbulBonusHand.textContent = "No bonus cards.";
    return;
  }
  if (!viewer.bonus_hand.length) {
    istanbulBonusHand.textContent = "No bonus cards.";
    return;
  }

  viewer.bonus_hand.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "istanbul-bonus-card";
    if (istanbulSelections.bonusCardId === card.uid) {
      button.classList.add("active");
    }
    const title = document.createElement("div");
    title.className = "istanbul-bonus-title";
    title.textContent = BONUS_LABELS[card.kind] || card.kind;
    const text = document.createElement("div");
    text.textContent = ISTANBUL_BONUS_INFO[card.kind]?.[1] || card.text || "";
    button.dataset.istanbulExplain = `${title.textContent}。${text.textContent}`;
    button.id = `istanbulBonusCard${card.uid}`;
    button.setAttribute("aria-pressed", String(istanbulSelections.bonusCardId === card.uid));
    button.appendChild(title);
    button.appendChild(text);
    button.addEventListener("click", () => {
      if (istanbulSelections.bonusCardId === card.uid) {
        istanbulSelections.bonusCardId = null;
      } else {
        istanbulSelections.bonusCardId = card.uid;
      }
      renderIstanbulGameState({ view });
    });
    istanbulBonusHand.appendChild(button);
  });
}

function renderIstanbulActionCenter(view) {
  if (!istanbulActionControls || !istanbulActionHint) return;
  istanbulActionControls.innerHTML = "";
  istanbulActionHint.textContent = "";
  if (istanbulPathHint && view.phase !== "movement") {
    istanbulPathHint.textContent = "";
  }

  if (view.game_over || view.phase === "game_over") {
    istanbulActionHint.textContent = `游戏结束 · ${(view.winner || []).map(id => formatPlayerName(view, id)).join("、")} 获胜`;
    return;
  }
  if (!selectionIsViewerTurn(view)) {
    istanbulActionHint.textContent = `等待 ${formatPlayerName(view, view.current_player)} 完成本回合。`;
    return;
  }

  const pending = view.pending;
  if (pending) {
    renderPendingAction(view, pending);
    return;
  }

  if (view.phase === "movement") {
    renderMovementControls(view);
    return;
  }

  if (view.phase === "assistant") {
    renderAssistantControls(view);
    return;
  }

  if (view.phase === "action") {
    renderPlaceActionControls(view);
    return;
  }

  if (view.phase === "game_over") {
    istanbulActionHint.textContent = "Game over.";
  }
}

function renderPendingAction(view, pending) {
  const type = pending.type;
  if (type === "reward") {
    istanbulActionHint.textContent = "遇到家族成员，请选择一项奖励。";
    const row = document.createElement("div");
    row.className = "istanbul-control-row";
    const cardBtn = buildButton("Take Bonus", "istanbulRewardCardBtn", () => {
      sendAction({ type: "choose_reward", choice: "card" });
    });
    const liraBtn = buildButton("Take 3 Lira💰", "istanbulRewardLiraBtn", () => {
      sendAction({ type: "choose_reward", choice: "lira" });
    }, "secondary");
    row.appendChild(cardBtn);
    row.appendChild(liraBtn);
    istanbulActionControls.appendChild(row);
    return;
  }
  if (type === "governor") {
    istanbulActionHint.textContent = "🎩 总督：选择支付方式，换取 1 张奖励卡，或 Skip。";
    const viewer = getViewer(view);
    const hasCards = viewer && viewer.bonus_hand && viewer.bonus_hand.length;
    const row = document.createElement("div");
    row.className = "istanbul-control-row";
    const skipBtn = buildButton("Skip", "istanbulGovSkipBtn", () => {
      sendAction({ type: "governor_choice", take: false });
    }, "secondary");
    const takeBtn = buildButton("Take Card", "istanbulGovTakeBtn", () => {
      const payload = { type: "governor_choice", take: true, payment: istanbulSelections.governorPayment };
      sendAction(payload);
    });
    row.appendChild(takeBtn);
    row.appendChild(skipBtn);
    istanbulActionControls.appendChild(row);
    const paymentRow = document.createElement("div");
    paymentRow.className = "istanbul-control-row";
    const paymentSelect = document.createElement("select");
    paymentSelect.className = "istanbul-select";
    paymentSelect.innerHTML = "<option value=\"lira\">Pay 2 Lira💰</option><option value=\"card\">Discard Bonus</option>";
    if (!hasCards) {
      const cardOption = paymentSelect.querySelector("option[value='card']");
      if (cardOption) {
        cardOption.disabled = true;
      }
      istanbulSelections.governorPayment = "lira";
    }
    const paymentMode = istanbulSelections.governorPayment === "lira" ? "lira" : "card";
    paymentSelect.value = paymentMode;
    paymentSelect.addEventListener("change", () => {
      if (paymentSelect.value === "lira") {
        istanbulSelections.governorPayment = "lira";
      } else {
        const firstCard = viewer && viewer.bonus_hand && viewer.bonus_hand.length ? viewer.bonus_hand[0].uid : null;
        istanbulSelections.governorPayment = firstCard || "lira";
      }
      renderIstanbulGameState({ view });
    });
    paymentSelect.setAttribute("aria-label", "总督交易支付方式");
    paymentRow.appendChild(paymentSelect);
    if (paymentMode === "card") {
      const discardSelect = buildBonusSelect(
        view,
        (value) => {
          istanbulSelections.governorPayment = value;
        },
        istanbulSelections.governorPayment === "lira" ? null : istanbulSelections.governorPayment
      );
      paymentRow.appendChild(discardSelect);
    }
    istanbulActionControls.appendChild(paymentRow);
    return;
  }
  if (type === "smuggler") {
    istanbulActionHint.textContent = "🕵️ 走私者：先选择获得什么，再选择如何支付。";
    const row = document.createElement("div");
    row.className = "istanbul-control-row";
    const takeBtn = buildButton("Take 1🔴/🟢/🟡/🔵", "istanbulSmugglerTakeBtn", () => {
      sendAction({
        type: "smuggler_choice",
        take: true,
        good: istanbulSelections.smugglerGood,
        payment: istanbulSelections.smugglerPayment,
      });
    });
    const skipBtn = buildButton("Skip", "istanbulSmugglerSkipBtn", () => {
      sendAction({ type: "smuggler_choice", take: false });
    }, "secondary");
    row.appendChild(takeBtn);
    row.appendChild(skipBtn);
    istanbulActionControls.appendChild(row);

    const opts = document.createElement("div");
    opts.className = "istanbul-control-row";
    const goodSelect = buildGoodSelect(istanbulSelections.smugglerGood, (value) => {
      istanbulSelections.smugglerGood = value;
    });
    const paySelect = document.createElement("select");
    paySelect.innerHTML = "<option value=\"lira\">Pay 2 Lira💰</option><option value=\"good\">Pay 1🔴/🟢/🟡/🔵</option>";
    paySelect.value = istanbulSelections.smugglerPayment === "lira" ? "lira" : "good";
    paySelect.addEventListener("change", () => {
      if (paySelect.value === "lira") {
        istanbulSelections.smugglerPayment = "lira";
      } else {
        istanbulSelections.smugglerPayment = istanbulSelections.smugglerPayment === "lira" ? "red" : istanbulSelections.smugglerPayment;
      }
      renderIstanbulGameState({ view });
    });
    goodSelect.setAttribute("aria-label", "走私者交易：想获得的货物");
    paySelect.setAttribute("aria-label", "走私者交易：支付方式");
    const gainLabel = document.createElement("label");
    gainLabel.textContent = "获得 ";
    gainLabel.append(goodSelect);
    const payLabel = document.createElement("label");
    payLabel.textContent = "支付 ";
    payLabel.append(paySelect);
    opts.append(gainLabel, payLabel);
    if (istanbulSelections.smugglerPayment !== "lira") {
      const payGood = buildGoodSelect(
        istanbulSelections.smugglerPayment,
        (value) => {
          istanbulSelections.smugglerPayment = value;
        },
        false
      );
      payGood.setAttribute("aria-label", "走私者交易：用哪种货物支付");
      const payGoodLabel = document.createElement("label");
      payGoodLabel.textContent = "用货物 ";
      payGoodLabel.append(payGood);
      opts.append(payGoodLabel);
    }
    istanbulActionControls.appendChild(opts);
    return;
  }
  if (type === "dice") {
    istanbulActionHint.textContent = `骰子总和：🎲 ${pending.roll}`;
    const row = document.createElement("div");
    row.className = "istanbul-control-row";
    const acceptBtn = buildButton("Accept", "istanbulDiceAcceptBtn", () => {
      sendAction({ type: "dice_modify", choice: "accept" });
    });
    row.appendChild(acceptBtn);
    const canModify = canUseGreen(view);
    const rerollBtn = buildButton(
      "Reroll (-2 Lira💰)",
      "istanbulDiceRerollBtn",
      () => sendAction({ type: "dice_modify", choice: "reroll" }),
      "secondary",
      !canModify
    );
    const plusBtn = buildButton(
      "+1 (-2 Lira💰)",
      "istanbulDicePlusBtn",
      () => sendAction({ type: "dice_modify", choice: "plus_one" }),
      "secondary",
      !canModify
    );
    row.appendChild(rerollBtn);
    row.appendChild(plusBtn);
    istanbulActionControls.appendChild(row);
    return;
  }
  if (type === "caravan_discard") {
    istanbulActionHint.textContent = "选择要弃掉的 1 张奖励卡。";
    const select = buildBonusSelect(
      view,
      (value) => {
        istanbulSelections.caravanDiscard = value;
      },
      istanbulSelections.caravanDiscard
    );
    istanbulActionControls.appendChild(select);
    const discardBtn = buildButton("Discard", "istanbulCaravanDiscardBtn", () => {
      sendAction({ type: "discard_bonus", card_id: istanbulSelections.caravanDiscard });
    }, "secondary", !istanbulSelections.caravanDiscard);
    istanbulActionControls.appendChild(discardBtn);
    return;
  }
}

function renderMovementControls(view) {
  const mode = view.movement_mode || "normal";
  if (mode === "stay") istanbulSelections.path = [];
  const steps = istanbulSelections.path.length;
  const limits = movementLimits(mode);
  const dest = getTileByPos(view, istanbulSelections.path.at(-1));
  istanbulActionHint.textContent = mode === "stay" ? "原地行动奖励已生效，确认后安排助手。" : dest ? `目的地：${istanbulPlaceName(dest)}。确认后才移动商人。` : `轻点高亮地点，自动规划 ${limits.min}–${limits.max} 格路线，再确认移动。`;
  if (istanbulPathHint) {
    const viewer = getViewer(view);
    const path = [viewer?.merchant_pos, ...istanbulSelections.path].map(pos => istanbulPlaceName(getTileByPos(view, pos)));
    istanbulPathHint.textContent = steps ? `路线：${path.join(" → ")}（${steps} 格）` : "棋盘按上下左右相邻；ⓘ 查看地点详情。";
  }
  const viewer = getViewer(view);
  const destination = dest || (mode === "stay" ? getTileByPos(view, viewer?.merchant_pos) : null);
  const problem = istanbulActionProblem(view, destination);
  const canUseWild = destination?.place_id === 11 && viewer?.bonus_hand?.some(card => card.kind === "BC_SMALL_MARKET_WILD") && GOODS.some(color => viewer.goods[color] > 0);
  const cannotAct = problem && !canUseWild && !problem.startsWith("没有可用助手") && !problem.includes("直接结束回合");
  const valid = steps >= limits.min && steps <= limits.max && !cannotAct;
  if (canUseWild && problem) appendActionNote("当前货物不符合需求；抵达后先使用小市场通配奖励卡，再卖货。");
  if (cannotAct) appendActionNote(`${problem} 请先补充资源或选择其他地点。`);
  istanbulActionControls.append(buildButton(dest ? `Move · ${istanbulPlaceName(dest)}` : mode === "stay" ? "Confirm · 原地行动" : "Move · 先选地点", "istanbulMoveBtn", () => sendAction({type: "move", path: [...istanbulSelections.path]}), "primary", !valid));
  renderBonusPlay(view);
  renderRedMosqueQuick(view);
}

function renderAssistantControls(view) {
  const viewer = getViewer(view);
  if (!viewer) return;
  const location = viewer.merchant_pos;
  const inStack = viewer.assistants_in_stack || 0;
  const hasHere = (viewer.assistants_on_board || []).includes(location);
  const canDrop = inStack > 0 && !hasHere;
  const canPick = hasHere;
  const isFountain = getTileByPos(view, location)?.place_id === 7;
  istanbulActionHint.textContent = hasHere ? "这里有你的助手：收回后即可执行地点行动。" : isFountain && !canDrop ? "这里是喷泉：无需助手也能召回队伍。" : "留下一名随行助手，换取本地点的一次行动；以后回来可把助手收回。";

  const row = document.createElement("div");
  row.className = "istanbul-control-row";
  row.appendChild(buildButton("放下助手 · 执行地点", "istanbulDropBtn", () => sendAction({ type: "assistant", mode: "drop" }), "primary", !canDrop));
  row.appendChild(buildButton("收回助手 · 执行地点", "istanbulPickBtn", () => sendAction({ type: "assistant", mode: "pickup" }), "secondary", !canPick));
  if (isFountain) {
    row.appendChild(buildButton("Skip", "istanbulSkipBtn", () => sendAction({ type: "assistant", mode: "none" }), "ghost", false));
  }
  istanbulActionControls.appendChild(row);
  renderBonusPlay(view);
  renderRedMosqueQuick(view);
}

function renderPlaceActionControls(view) {
  const viewer = getViewer(view);
  if (!viewer) return;
  const tile = getTileByPos(view, viewer.merchant_pos);
  if (!tile) return;
  const placeType = tile.type;
  istanbulActionHint.textContent = `当前位置：${istanbulPlaceName(tile)}，请选择本次行动。`;

  if (placeType === "wainwright") {
    const canPay = viewer.lira >= 7 && viewer.capacity < 5;
    if (!canPay) {
      const reasons = [];
      if (viewer.lira < 7) reasons.push("Need 7 Lira💰.");
      if (viewer.capacity >= 5) reasons.push("Cart📦 already at max (5).");
      appendActionNote(reasons.join(" "));
    }
    const btn = buildButton("📦 升级货车 · 7 里拉", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary", !canPay);
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "warehouse") {
    const btn = buildButton("补满本色货物", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "post_office") {
    const btn = buildButton("领取邮局资源", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "caravansary") {
    const btn = buildButton("抽 2 张奖励卡", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "fountain") {
    renderFountainControls(view, false);
  } else if (placeType === "black_market") {
    renderBlackMarketControls(view, false);
  } else if (placeType === "tea_house") {
    renderTeaHouseControls(view, false);
  } else if (placeType === "market_large" || placeType === "market_small") {
    renderMarketControls(view, placeType, false);
  } else if (placeType === "police_station") {
    renderPoliceControls(view);
  } else if (placeType === "sultan_palace") {
    const idx = Number.isInteger(view.sultan_index) ? view.sultan_index : 0;
    const cost = Array.isArray(view.sultan_costs) ? view.sultan_costs[idx] : null;
    if (!canPaySultanCost(viewer.goods || {}, cost)) {
      const costText = formatSultanCost(cost);
      appendActionNote(costText ? `Need ${costText} to buy a Ruby💎.` : "Not enough goods to buy a Ruby💎.");
    }
    const btn = buildButton("💎 购买红宝石", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary", !canPaySultanCost(viewer.goods, cost));
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "gemstone_dealer") {
    const idx = Number.isInteger(view.gem_index) ? view.gem_index : 0;
    const cost = Array.isArray(view.gem_costs) ? view.gem_costs[idx] : null;
    if (Number.isInteger(cost) && viewer.lira < cost) {
      appendActionNote(`Need ${cost} Lira💰 to buy a Ruby💎.`);
    }
    const btn = buildButton("💎 购买红宝石", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary", !Number.isInteger(cost) || viewer.lira < cost);
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "small_mosque" || placeType === "great_mosque") {
    renderMosqueControls(view, placeType, false);
  } else {
    const btn = buildButton("Do Action", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
    istanbulActionControls.appendChild(btn);
  }

  renderBonusPlay(view);
  renderRedMosqueQuick(view);
}

function renderPoliceControls(view) {
  const viewer = getViewer(view);
  if (!viewer) return;
  const policeTile = getTileByPlaceId(view, 12);
  if (!policeTile) return;
  if (viewer.family_pos !== policeTile.pos) {
    const note = document.createElement("div");
    note.textContent = "家族成员不在警察局，本次无法派出。";
    istanbulActionControls.appendChild(note);
    istanbulActionControls.appendChild(buildButton("Continue", "istanbulPoliceContinueBtn", () => sendAction({type: "location_action"})));
    return;
  }
  istanbulActionHint.textContent = "点选家族成员要去的地点，再确认派出。";
  const dest = istanbulSelections.familyDestination;
  const destTile = dest !== null ? getTileByPos(view, dest) : null;
  const row = document.createElement("div");
  row.className = "istanbul-control-row";
  const label = document.createElement("div");
  label.textContent = destTile ? `目的地：${istanbulPlaceName(destTile)}` : "先在棋盘选择目的地";
  row.appendChild(label);
  istanbulActionControls.appendChild(row);

  if (destTile) {
    renderFamilyDestinationControls(view, destTile);
    const sendBtn = buildButton("Send Family", "istanbulFamilySendBtn", () => {
      const payload = buildFamilyPayload(destTile);
      sendAction(payload);
    }, "primary", Boolean(istanbulActionProblem(view, destTile, true)) || ((destTile.place_id === 10 || destTile.place_id === 11) && !GOODS.some(c => istanbulSelections.marketGoods[c] > 0)) || ((destTile.place_id === 15 || destTile.place_id === 16) && !istanbulSelections.mosqueColor));
    istanbulActionControls.appendChild(sendBtn);
  }
}

function renderFamilyDestinationControls(view, destTile) {
  if (destTile.type === "fountain") {
    renderFountainControls(view, true);
  } else if (destTile.type === "black_market") {
    renderBlackMarketControls(view, true);
  } else if (destTile.type === "tea_house") {
    renderTeaHouseControls(view, true);
  } else if (destTile.type === "market_large" || destTile.type === "market_small") {
    renderMarketControls(view, destTile.type, true);
  } else if (destTile.type === "small_mosque" || destTile.type === "great_mosque") {
    renderMosqueControls(view, destTile.type, true);
  }
}

function buildFamilyPayload(destTile) {
  const payload = { type: "location_action", destination: destTile.pos };
  if (destTile.type === "fountain") {
    if (istanbulSelections.fountainReturns.size) {
      payload.return_assistants = Array.from(istanbulSelections.fountainReturns);
    }
  } else if (destTile.type === "black_market") {
    payload.good = istanbulSelections.blackGood;
  } else if (destTile.type === "tea_house") {
    payload.target = istanbulSelections.teaTarget;
  } else if (destTile.type === "market_large" || destTile.type === "market_small") {
    payload.goods = { ...istanbulSelections.marketGoods };
  } else if (destTile.type === "small_mosque" || destTile.type === "great_mosque") {
    payload.color = istanbulSelections.mosqueColor;
  }
  return payload;
}

function renderFountainControls(view, isFamily) {
  const viewer = getViewer(view);
  if (!viewer) return;
  const assistants = viewer.assistants_on_board || [];
  const info = document.createElement("div");
  info.textContent = "点选要召回的助手；不选时召回全部。";
  istanbulActionControls.appendChild(info);
  if (assistants.length) {
    const row = document.createElement("div");
    row.className = "istanbul-control-row";
    assistants.forEach((pos) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "istanbul-btn secondary";
      const tile = getTileByPos(view, pos);
      btn.textContent = tile ? tile.name : `Pos ${pos}`;
      btn.addEventListener("click", () => {
        if (istanbulSelections.fountainReturns.has(pos)) {
          istanbulSelections.fountainReturns.delete(pos);
        } else {
          istanbulSelections.fountainReturns.add(pos);
        }
        renderIstanbulGameState({ view });
      });
      if (istanbulSelections.fountainReturns.has(pos)) {
        btn.classList.add("active");
      }
      row.appendChild(btn);
    });
    istanbulActionControls.appendChild(row);
  }
  if (!isFamily) {
    const btn = buildButton("👥 召回助手", "istanbulActionBtn", () => {
      const payload = { type: "location_action" };
      if (istanbulSelections.fountainReturns.size) {
        payload.return_assistants = Array.from(istanbulSelections.fountainReturns);
      }
      sendAction(payload);
    }, "primary", false);
    istanbulActionControls.appendChild(btn);
  }
}

function renderBlackMarketControls(view, isFamily) {
  const row = document.createElement("div");
  row.className = "istanbul-control-row";
  row.appendChild(buildGoodSelect(istanbulSelections.blackGood, (value) => {
    istanbulSelections.blackGood = value;
  }, true));
  istanbulActionControls.appendChild(row);
  if (!isFamily) {
    const btn = buildButton("领取货物并掷骰", "istanbulActionBtn", () => {
      sendAction({ type: "location_action", good: istanbulSelections.blackGood });
    }, "primary");
    istanbulActionControls.appendChild(btn);
  }
}

function renderTeaHouseControls(view, isFamily) {
  const row = document.createElement("div");
  row.className = "istanbul-control-row";
  const input = document.createElement("input");
  input.type = "number";
  input.setAttribute("aria-label", "茶馆报数，3 到 12");
  input.min = "3";
  input.max = "12";
  input.value = istanbulSelections.teaTarget;
  input.addEventListener("change", () => {
    const value = parseInt(input.value, 10);
    if (Number.isInteger(value)) {
      istanbulSelections.teaTarget = Math.max(3, Math.min(12, value));
    }
  });
  const teaLabel = document.createElement("label");
  teaLabel.textContent = "报数（3–12） ";
  teaLabel.append(input);
  row.appendChild(teaLabel);
  istanbulActionControls.appendChild(row);
  if (!isFamily) {
    const btn = buildButton("掷骰 · 赚取里拉", "istanbulActionBtn", () => {
      sendAction({ type: "location_action", target: istanbulSelections.teaTarget });
    }, "primary");
    istanbulActionControls.appendChild(btn);
  }
}

function renderMarketControls(view, placeType, isFamily) {
  const viewer = getViewer(view);
  const marketKey = placeType === "market_large" ? "market_large" : "market_small";
  const market = view[marketKey] || {};
  const demand = market.current ? market.current.goods || {} : {};
  const allowWild = placeType === "market_small" && view.small_market_wild;
  clampMarketGoods(view, demand, allowWild);

  const demandLine = document.createElement("div");
  demandLine.textContent = `Demand: ${formatGoodsLine(demand)}`;
  demandLine.dataset.istanbulTip = `市场需求：${formatGoodsLine(demand)}。每色出售数量不能超过需求和持有量，每次最多出售 5 件。`;
  istanbulActionControls.appendChild(demandLine);
  if (allowWild) {
    const wild = document.createElement("div");
    wild.textContent = "Wild bonus active: any goods 🔴/🟢/🟡/🔵 are accepted.";
    istanbulActionControls.appendChild(wild);
  }

  GOODS.forEach((color) => {
    const row = document.createElement("div");
    row.className = "istanbul-good-stepper";
    const label = document.createElement("span");
    label.textContent = `${GOOD_LABELS[color]} ${ISTANBUL_GOOD_NAMES[color]}`;
    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "istanbul-good-btn";
    minus.textContent = "-";
    minus.disabled = istanbulSelections.marketGoods[color] <= 0;
    minus.addEventListener("click", () => {
      istanbulSelections.marketGoods[color] = Math.max(0, istanbulSelections.marketGoods[color] - 1);
      renderIstanbulGameState({ view });
    });
    const value = document.createElement("span");
    value.textContent = istanbulSelections.marketGoods[color];
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "istanbul-good-btn";
    const maxByGoods = viewer ? viewer.goods[color] || 0 : 0;
    const maxByReq = allowWild ? maxByGoods : Math.min(maxByGoods, demand[color] || 0);
    const total = GOODS.reduce((sum, g) => sum + (istanbulSelections.marketGoods[g] || 0), 0);
    plus.disabled = istanbulSelections.marketGoods[color] >= maxByReq || total >= 5;
    plus.textContent = "+";
    plus.addEventListener("click", () => {
      istanbulSelections.marketGoods[color] += 1;
      renderIstanbulGameState({ view });
    });
    row.appendChild(label);
    row.appendChild(minus);
    row.appendChild(value);
    row.appendChild(plus);
    istanbulActionControls.appendChild(row);
  });

  const total = GOODS.reduce((sum, g) => sum + (istanbulSelections.marketGoods[g] || 0), 0);
  const revenueTable = view.market_revenue ? view.market_revenue[placeType === "market_large" ? "large" : "small"] : null;
  if (revenueTable) {
    const payout = revenueTable[total] || 0;
    const summary = document.createElement("div");
    summary.textContent = `出售 ${total} 件货物 → 获得 💰 ${payout} 里拉`;
    summary.dataset.istanbulTip = `本次选中 ${total} 件货物，按市场售价将获得 ${payout} 里拉。每次最多出售 5 件。`;
    istanbulActionControls.appendChild(summary);
  }
  if (!isFamily) {
    if (total <= 0) {
      const goodsTotal = viewer ? GOODS.reduce((sum, g) => sum + (viewer.goods[g] || 0), 0) : 0;
      if (!goodsTotal) {
        appendActionNote("No goods available to sell.");
      } else if (!allowWild) {
        const matchesDemand = GOODS.some((color) => (demand[color] || 0) > 0 && (viewer.goods[color] || 0) > 0);
        if (!matchesDemand) {
          appendActionNote("No goods match the current demand.");
        } else {
          appendActionNote("Select goods to sell.");
        }
      } else {
        appendActionNote("Select goods to sell.");
      }
    }
    const sellBtn = buildButton("卖出所选货物", "istanbulActionBtn", () => {
      sendAction({ type: "location_action", goods: { ...istanbulSelections.marketGoods } });
    }, "primary", total <= 0 || total > 5);
    istanbulActionControls.appendChild(sellBtn);
  }
}

function renderMosqueControls(view, placeType, isFamily) {
  const viewer = getViewer(view);
  const mosqueKey = placeType === "small_mosque" ? "small" : "great";
  const row = document.createElement("div");
  row.className = "istanbul-control-row";
  const options = placeType === "small_mosque" ? ["red", "green"] : ["yellow", "blue"];
  const availableColors = options.filter(c => view.mosques?.[mosqueKey]?.[c] && viewer?.goods?.[c] > 0 && !viewer?.mosque_tiles?.[c]);
  if (isFamily && !availableColors.includes(istanbulSelections.mosqueColor)) istanbulSelections.mosqueColor = availableColors[0] || null;
  let anyAvailable = false;
  options.forEach((color) => {
    const available = view.mosques && view.mosques[mosqueKey] ? view.mosques[mosqueKey][color] : true;
    const hasGood = viewer && viewer.goods ? viewer.goods[color] > 0 : false;
    const disabled = !available || !hasGood || Boolean(viewer?.mosque_tiles?.[color]);
    if (!disabled) anyAvailable = true;
    const btn = buildButton(`领取 ${GOOD_LABELS[color]} ${ISTANBUL_GOOD_NAMES[color]}板块`, `istanbulMosque${color}Btn`, () => {
      istanbulSelections.mosqueColor = color;
      if (!isFamily) {
        sendAction({ type: "location_action", color });
      } else {
        renderIstanbulGameState({ view });
      }
    }, "secondary", disabled);
    btn.classList.toggle("active", isFamily && istanbulSelections.mosqueColor === color);
    row.appendChild(btn);
  });
  istanbulActionControls.appendChild(row);
  if (!isFamily && !anyAvailable) {
    appendActionNote("Need 1 matching good and an available mosque tile.");
  }
}

function renderBonusPlay(view) {
  if (!view.legal_actions || !view.legal_actions.includes("play_bonus")) return;
  const viewer = getViewer(view);
  if (!viewer) return;
  const card = viewer.bonus_hand && viewer.bonus_hand.find((c) => c.uid === istanbulSelections.bonusCardId);
  if (!card) return;

  const info = document.createElement("div");
  const playable = bonusPlayableNow(view, card);
  info.textContent = `Selected Bonus: ${BONUS_LABELS[card.kind] || card.kind}${playable ? "" : " (not available here)"}`;
  istanbulActionControls.appendChild(info);

  let canPlay = playable;
  if (card.kind === "BC_GOOD") {
    istanbulActionControls.appendChild(buildGoodSelect(istanbulSelections.bonusGood, (value) => {
      istanbulSelections.bonusGood = value;
    }));
  } else if (card.kind === "BC_RETURN_ASSISTANT") {
    const viewer = getViewer(view);
    const row = document.createElement("div");
    row.className = "istanbul-control-row";
    (viewer.assistants_on_board || []).forEach((pos) => {
      const tile = getTileByPos(view, pos);
      const btn = buildButton(tile ? tile.name : `Pos ${pos}`, `istanbulBonusAssistant${pos}`, () => {
        istanbulSelections.bonusAssistant = pos;
        renderIstanbulGameState({ view });
      }, "secondary");
      if (istanbulSelections.bonusAssistant === pos) {
        btn.classList.add("active");
      }
      row.appendChild(btn);
    });
    istanbulActionControls.appendChild(row);
    if (istanbulSelections.bonusAssistant === null) {
      canPlay = false;
    }
  } else if (card.kind === "BC_FAMILY_POLICE_REWARD") {
    const row = document.createElement("div");
    row.className = "istanbul-control-row";
    const cardBtn = buildButton("Take Bonus", "istanbulBonusRewardCard", () => {
      istanbulSelections.bonusRewardChoice = "card";
      renderIstanbulGameState({ view });
    }, "secondary");
    const liraBtn = buildButton("Take 3 Lira💰", "istanbulBonusRewardLira", () => {
      istanbulSelections.bonusRewardChoice = "lira";
      renderIstanbulGameState({ view });
    }, "secondary");
    if (istanbulSelections.bonusRewardChoice === "card") {
      cardBtn.classList.add("active");
    } else {
      liraBtn.classList.add("active");
    }
    row.appendChild(cardBtn);
    row.appendChild(liraBtn);
    istanbulActionControls.appendChild(row);
  }

  const playBtn = buildButton("Play Bonus", "istanbulBonusPlayBtn", () => {
    const payload = { type: "play_bonus", card_id: card.uid };
    if (card.kind === "BC_GOOD") {
      payload.good = istanbulSelections.bonusGood;
    } else if (card.kind === "BC_RETURN_ASSISTANT") {
      payload.assistant_pos = istanbulSelections.bonusAssistant;
    } else if (card.kind === "BC_FAMILY_POLICE_REWARD") {
      payload.choice = istanbulSelections.bonusRewardChoice;
    }
    sendAction(payload);
  }, "primary", !canPlay);
  istanbulActionControls.appendChild(playBtn);
}

function bonusPlayableNow(view, card) {
  if (!view || !card) return false;
  const phase = view.phase;
  const viewer = getViewer(view);
  const tile = viewer ? getTileByPos(view, viewer.merchant_pos) : null;
  const placeId = tile ? tile.place_id : null;
  if (card.kind === "BC_NO_MOVE" || card.kind === "BC_MOVE_3_4" || card.kind === "BC_RETURN_ASSISTANT") {
    return phase === "movement";
  }
  if (card.kind === "BC_SULTAN_2X") {
    return phase === "action" && placeId === 13;
  }
  if (card.kind === "BC_POST_2X") {
    return phase === "action" && placeId === 5;
  }
  if (card.kind === "BC_GEM_2X") {
    return phase === "action" && placeId === 14;
  }
  if (card.kind === "BC_SMALL_MARKET_WILD") {
    return phase === "action" && placeId === 11;
  }
  if (card.kind === "BC_FAMILY_POLICE_REWARD") {
    const police = getTileByPlaceId(view, 12);
    if (viewer && police && viewer.family_pos === police.pos) {
      return false;
    }
  }
  if (card.kind === "BC_GOOD" || card.kind === "BC_LIRA5" || card.kind === "BC_FAMILY_POLICE_REWARD") {
    return phase === "movement" || phase === "assistant" || phase === "action";
  }
  return true;
}

function renderRedMosqueQuick(view) {
  const viewer = getViewer(view);
  if (!viewer || !viewer.mosque_tiles || !viewer.mosque_tiles.red) return;
  if (viewer.lira < 2) return;
  if (!viewer.assistants_on_board.length) return;
  const title = document.createElement("div");
  title.textContent = "🔴 Mosque: recall assistant (2 Lira💰)";
  istanbulActionControls.appendChild(title);
  const row = document.createElement("div");
  row.className = "istanbul-control-row";
  viewer.assistants_on_board.forEach((pos) => {
    const tile = getTileByPos(view, pos);
    const btn = buildButton(tile ? tile.name : `Pos ${pos}`, `istanbulRedReturn${pos}`, () => {
      sendAction({ type: "mosque_return_assistant", assistant_pos: pos });
    }, "ghost");
    row.appendChild(btn);
  });
  istanbulActionControls.appendChild(row);
}

function buildButton(label, id, onClick, variant = "primary", disabled = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = id;
  btn.className = `istanbul-btn ${variant}`;
  btn.textContent = label;
  btn.disabled = !!disabled;
  if (!disabled) {
    btn.addEventListener("click", onClick);
  }
  return btn;
}

function buildGoodSelect(selected, onChange, restrictBasic = false) {
  const select = document.createElement("select");
  const options = restrictBasic ? ["red", "green", "yellow"] : GOODS;
  options.forEach((color) => {
    const option = document.createElement("option");
    option.value = color;
    option.textContent = `${GOOD_LABELS[color]} ${ISTANBUL_GOOD_NAMES[color]}`;
    select.appendChild(option);
  });
  select.value = selected;
  select.addEventListener("change", () => {
    onChange(select.value);
    renderIstanbulGameState({ view: currentIstanbulView });
  });
  return select;
}

function buildBonusSelect(view, onChange, selectedId) {
  const viewer = getViewer(view);
  const select = document.createElement("select");
  (viewer && viewer.bonus_hand ? viewer.bonus_hand : []).forEach((card) => {
    const option = document.createElement("option");
    option.value = card.uid;
    option.textContent = BONUS_LABELS[card.kind] || card.kind;
    select.appendChild(option);
  });
  if (selectedId) {
    select.value = selectedId;
  }
  select.addEventListener("change", () => {
    onChange(select.value);
    renderIstanbulGameState({ view: currentIstanbulView });
  });
  onChange(select.value);
  return select;
}

function movementLimits(mode) {
  if (mode === "long") return { min: 3, max: 4 };
  if (mode === "stay") return { min: 0, max: 0 };
  return { min: 1, max: 2 };
}

function canUseGreen(view) {
  const viewer = getViewer(view);
  return viewer && viewer.mosque_tiles && viewer.mosque_tiles.green && viewer.lira >= 2;
}

if (istanbulHelpBtn) {
  istanbulHelpBtn.addEventListener("click", () => {
    showIstanbulHelpModal();
  });
}

if (istanbulHelpModalCloseBtn) {
  istanbulHelpModalCloseBtn.addEventListener("click", closeIstanbulHelpModal);
}

if (istanbulExplainBtn) {
  istanbulExplainBtn.addEventListener("click", () => {
    toggleIstanbulExplainMode();
  });
}

if (istanbulExplainModalCloseBtn) {
  istanbulExplainModalCloseBtn.addEventListener("click", closeIstanbulExplainModal);
}

if (istanbulMarketsToggle) {
  istanbulMarketsToggle.addEventListener("click", () => toggleIstanbulOverlay("markets"));
}

if (istanbulMosquesToggle) {
  istanbulMosquesToggle.addEventListener("click", () => toggleIstanbulOverlay("mosques"));
}

if (istanbulPostOfficeToggle) {
  istanbulPostOfficeToggle.addEventListener("click", () => toggleIstanbulOverlay("post"));
}

if (istanbulBoardOverlays) {
  istanbulBoardOverlays.addEventListener("click", (event) => {
    if (event.target.closest(".istanbul-overlay-card")) return;
    closeIstanbulOverlays();
    event.stopPropagation();
  });
}

if (istanbulGamePanel) {
  istanbulGamePanel.addEventListener("click", (event) => {
    if (
      event.istanbulTipDismissed || istanbulExplainMode ||
      event.target.closest("[data-istanbul-tip], details, label") ||
      event.target.closest("button") ||
      event.target.closest("input") ||
      event.target.closest("select") ||
      event.target.closest("textarea") ||
      event.target.closest(".istanbul-overlay-card") ||
      event.target.closest(".istanbul-tile")
    ) {
      return;
    }
    if (!currentIstanbulView) return;
    istanbulInspectedPos = null;
    istanbulSelections.path = [];
    istanbulSelections.bonusCardId = null;
    istanbulSelections.familyDestination = null;
    renderIstanbulGameState({ view: currentIstanbulView });
  });
}


function istanbulPlaceName(tile) {
    return tile ? ISTANBUL_PLACES[tile.place_id]?.[0] || tile.name : "—";
}

function istanbulActionProblem(view, tile, family = false) {
    const player = getViewer(view);
    if (!player || !tile) return "";
    const id = tile.place_id;
    const fee = !family && view.phase === "movement" && id !== 7
        ? 2 * (view.players || []).filter(p => p.player_id !== view.you && p.merchant_pos === tile.pos).length : 0;
    const lira = player.lira - fee;
    if (lira < 0) return `这里有其他商人，需要 ${fee} 里拉；余额不足会直接结束回合。`;
    if (!family && view.phase === "movement" && id !== 7 && !player.assistants_in_stack && !player.assistants_on_board.includes(tile.pos)) return "没有可用助手：到达后会跳过地点行动。建议去喷泉召回助手。";
    if (id === 1 && (lira < 7 || player.capacity >= 5)) return player.capacity >= 5 ? "货车已升到最高容量 5，无法继续升级。" : `升级需要 7 里拉，抵达后只有 ${lira} 里拉。`;
    if (id === 14) {
        const cost = view.gem_costs?.[view.gem_index || 0];
        if (!Number.isInteger(cost)) return "这里的红宝石已售罄。";
        if (lira < cost) return `本颗红宝石需要 ${cost} 里拉，抵达后还差 ${cost - lira} 里拉。`;
    }
    if (id === 13) {
        const cost = view.sultan_costs?.[view.sultan_index || 0];
        if (!cost) return "这里的红宝石已售罄。";
        if (!canPaySultanCost(player.goods, cost)) return `货物不足，需要 ${formatSultanCost(cost)}。`;
    }
    if (id === 10 || id === 11) {
        const demand = view[id === 10 ? "market_large" : "market_small"]?.current?.goods || {};
        if (!GOODS.some(c => player.goods[c] > 0 && (demand[c] > 0 || (id === 11 && view.small_market_wild)))) return "没有符合市场需求的货物，先去仓库补货。";
    }
    if (id === 15 || id === 16) {
        const colors = id === 15 ? ["red", "green"] : ["yellow", "blue"];
        const pool = view.mosques?.[id === 15 ? "small" : "great"] || {};
        if (!colors.some(c => pool[c] && player.goods[c] > 0 && !player.mosque_tiles[c])) return "没有可领取的板块：需要 1 件对应货物、板块仍可用且你尚未拥有。";
    }
    return "";
}

function istanbulPlaceInfo(view, tile) {
    if (!tile) return "";
    const parts = [`#${tile.place_id} ${istanbulPlaceName(tile)}（${tile.name}）。${ISTANBUL_PLACES[tile.place_id]?.[2] || ""}`];
    if (tile.place_id === 14) parts.push(`当前价格：${view.gem_costs?.[view.gem_index || 0] ?? "售罄"} 里拉。`);
    if (tile.place_id === 13) parts.push(`当前费用：${formatSultanCost(view.sultan_costs?.[view.sultan_index || 0]) || "售罄"}。`);
    if (tile.place_id === 10 || tile.place_id === 11) {
        const key = tile.place_id === 10 ? "market_large" : "market_small";
        const demand = view[key]?.current?.goods || {};
        const revenue = view.market_revenue?.[tile.place_id === 10 ? "large" : "small"] || {};
        parts.push(`需求：${formatGoodsLine(demand)}。售出件数与收入：${Object.entries(revenue).map(([n,c]) => `${n} 件得 ${c} 里拉`).join("；")}。`);
    }
    if (tile.dice) parts.push(`骰点 ${tile.dice}：总督或走私者移动掷出此数时来到这里。`);
    for (const player of view.players || []) {
        const name = player.name || player.player_id;
        if (player.merchant_pos === tile.pos) parts.push(`${name} 的商人在此${player.player_id === view.you ? "（你）" : "；其他商人抵达需付 2 里拉，喷泉除外"}。`);
        if (player.assistants_on_board?.includes(tile.pos)) parts.push(`👥 ${name} 的助手在此，主人抵达可收回并执行地点行动。`);
        if (player.family_pos === tile.pos) parts.push(`👪 ${name} 的家族成员在此；其他商人遇到可领取奖励并将其送回警察局。`);
    }
    if (view.npc?.governor === tile.pos) parts.push("🎩 总督：行动后可付 2 里拉或弃 1 张卡换取 1 张奖励卡，也可跳过。");
    if (view.npc?.smuggler === tile.pos) parts.push("🕵️ 走私者：行动后可付 2 里拉或 1 件货物换取 1 件货物，也可跳过。");
    return parts.join(" ");
}

function renderIstanbulGuide(view) {
    const guide = document.getElementById("istanbulGuide");
    if (!guide) return;
    guide.replaceChildren();
    const player = getViewer(view);
    const ownTurn = selectionIsViewerTurn(view);
    const pending = view.pending;
    const stepIndex = view.phase === "movement" ? 0 : view.phase === "assistant" ? 1 : 2;
    const steps = document.createElement("div");
    steps.className = "istanbul-steps";
    ["1 选择地点", "2 安排助手", "3 行动与相遇"].forEach((label, index) => {
        const step = document.createElement("span");
        step.textContent = label;
        step.classList.toggle("active", ownTurn && index === stepIndex && !view.game_over);
        step.dataset.istanbulTip = ["移动阶段：通常上下左右走 1–2 格。点目的地预览后确认。", "助手阶段：放下或收回自己的 1 名助手，获得地点行动资格。喷泉可免助手。", "行动与相遇：执行地点行动，完成待处理的选择后自动轮到下一位。"][index];
        if (ownTurn && index === stepIndex) step.setAttribute("aria-current", "step");
        steps.append(step);
    });
    const title = document.createElement("strong");
    const hint = document.createElement("p");
    if (view.game_over) {
        title.textContent = `游戏结束 · ${(view.winner || []).map(id => formatPlayerName(view,id)).join("、")} 获胜`;
        hint.textContent = "比较红宝石数量；平手依次比较里拉、货物总数与奖励卡数量。";
    } else if (!ownTurn) {
        title.textContent = `等待 ${formatPlayerName(view, view.current_player)} 行动`;
        hint.textContent = player ? "趁现在规划下一站：补货 → 卖货 → 买红宝石。点地点或 ⓘ 查看效果。" : "你正在观战。点地点或 ⓘ 了解集市中的行动。";
    } else if (pending) {
        const prompts = {
            reward: ["遇到家族成员：选择奖励", "奖励卡可改变行动；3 里拉可立即用于支付。完成选择后继续相遇。"],
            governor: ["遇到总督：可选交易", "支付 2 里拉或弃 1 张奖励卡，换取 1 张新卡；也可 Skip。"],
            smuggler: ["遇到走私者：可选交易", "先选想拿的货物与支付方式，再确认；也可 Skip。"],
            dice: ["查看骰子结果", "Accept 接受结果。拥有绿色清真寺能力且钱足够时，可付 2 里拉调整。"],
            caravan_discard: ["商队旅馆：抽二弃一", "已抽入 2 张奖励卡，请从全部手牌中选 1 张弃掉。"],
        };
        [title.textContent, hint.textContent] = prompts[pending.type] || ["完成当前选择", "按行动区提示继续。"];
    } else if (view.phase === "movement") {
        title.textContent = "你的回合 · 先选下一站";
        const suggestions = [...istanbulReachableRoutes(view).keys()].map(pos => getTileByPos(view,pos)).filter(tile => tile && [2,3,4,5,9].includes(tile.place_id) && !istanbulActionProblem(view,tile));
        hint.textContent = player && player.assistants_in_stack === 0 ? "随行助手用完了：去有自己助手的地点收回，或去喷泉召回队伍。" : suggestions.length ? `入门建议：${suggestions.slice(0,2).map(istanbulPlaceName).join("或")}可获取资源。高亮地点可达，确认前先看费用。` : "先补货，再在市场卖货，最后买红宝石。点高亮地点查看本次行动。";
    } else if (view.phase === "assistant") {
        title.textContent = `你的回合 · ${istanbulPlaceName(getTileByPos(view,player?.merchant_pos))}`;
        hint.textContent = "放下或收回助手后才执行地点行动。以后回到留过助手的地点，就能把他带回队伍。";
    } else {
        title.textContent = "你的回合 · 执行地点行动";
        hint.textContent = "在下方选择并确认。行动及相遇结束后自动换人；特殊奖励卡要在行动前使用。";
    }
    if (view.final_round?.active && !view.game_over) hint.textContent += ` 最后一轮：${formatPlayerName(view,view.final_round.triggered_by)} 已达目标。`;
    guide.append(steps, title, hint);
}

function renderIstanbulDestination(view) {
    const panel = document.getElementById("istanbulDestination");
    if (!panel) return;
    const player = getViewer(view);
    const pos = istanbulSelections.familyDestination ?? istanbulSelections.path.at(-1) ?? (view.phase === "movement" || !selectionIsViewerTurn(view) ? istanbulInspectedPos : null) ?? player?.merchant_pos;
    const tile = getTileByPos(view,pos);
    panel.replaceChildren();
    if (!tile) return;
    const title = document.createElement("strong");
    title.textContent = `#${tile.place_id} ${istanbulPlaceName(tile)}`;
    const desc = document.createElement("p");
    desc.textContent = ISTANBUL_PLACES[tile.place_id]?.[2] || "";
    panel.append(title, desc);
    if (tile.place_id === 14 || tile.place_id === 13) {
        const price = document.createElement("p");
        price.textContent = tile.place_id === 14 ? `当前价格：💰 ${view.gem_costs?.[view.gem_index || 0] ?? "售罄"}` : `当前费用：${formatSultanCost(view.sultan_costs?.[view.sultan_index || 0]) || "售罄"}`;
        price.dataset.istanbulTip = "购买红宝石要支付当前价格；每购买一颗，下次价格会增加。";
        panel.append(price);
    }
    const problem = istanbulActionProblem(view,tile,istanbulSelections.familyDestination !== null);
    const fee = tile.place_id === 7 ? 0 : 2 * (view.players || []).filter(p => p.player_id !== view.you && p.merchant_pos === tile.pos).length;
    if (problem || (view.phase === "movement" && fee > 0)) {
        const note = document.createElement("p");
        note.className = "istanbul-action-note";
        note.textContent = problem || `抵达时先支付 ${fee} 里拉给其他商人，再执行地点行动。`;
        panel.append(note);
    }
    if (view.phase === "movement" && pos !== player?.merchant_pos && !istanbulReachableRoutes(view).has(pos)) {
        const note = document.createElement("p");
        note.textContent = "本回合无法到达这里。选择高亮地点，或先使用改变移动的奖励卡。";
        panel.append(note);
    }
}

function istanbulExplainText(text) {
    istanbulHints?.hide();
    exitIstanbulExplainMode();
    istanbulExplainContent.replaceChildren();
    const body = document.createElement("p");
    body.textContent = text;
    istanbulExplainContent.append(body);
    const glossary = [["里拉", "💰"], ["红宝石", "💎"], ["容量", "📦"], ["助手", "👥"], ["奖励卡", "🎴"], ["布料", "🔴"], ["香料", "🟢"], ["水果", "🟡"], ["珠宝", "🔵"]].filter(([name]) => text.includes(name));
    if (glossary.length) {
        const legend = document.createElement("p");
        legend.className = "istanbul-explain-legend";
        legend.textContent = glossary.map(([name, icon]) => `${name}（${icon}）`).join(" · ");
        istanbulExplainContent.append(legend);
    }
    setModalVisible(istanbulExplainModal, true);
}

function istanbulControlExplanation(button, view) {
    const id = button.id;
    const tile = getTileByPos(view, getViewer(view)?.merchant_pos);
    if (id === "istanbulMoveBtn") {
        const dest = getTileByPos(view, istanbulSelections.path.at(-1) ?? getViewer(view)?.merchant_pos);
        return `移动：通常上下左右走 1–2 格，只在终点执行行动。先选高亮目的地再确认。${istanbulActionProblem(view,dest)}`;
    }
    if (id === "istanbulActionBtn") return `${istanbulPlaceInfo(view,tile)} ${istanbulActionProblem(view,tile)}`;
    const explanations = {
        istanbulMoveBtn: "移动：按选定路线移动商人，只在终点执行行动。通常上下左右走 1–2 格；未选可用地点时无法确认。",
        istanbulDropBtn: "放下助手：将 1 名随行助手留在这里，然后执行地点行动。需要有随行助手，且这里没有自己的助手。",
        istanbulPickBtn: "收回助手：带走这里自己的助手，同时获得地点行动。这里没有自己的助手时不可选。",
        istanbulSkipBtn: "喷泉：不放下或收回助手，直接进入喷泉召回行动。",
        istanbulFamilySendBtn: "派出家族成员：执行所选目的地行动；无需移动商人或助手，不触发相遇。要先选可执行的目的地与所需选项。",
        istanbulBonusPlayBtn: "打出所选奖励卡并执行其效果。移动卡只在移动前使用；双倍行动卡须在对应地点行动前使用。",
        istanbulGovTakeBtn: "总督：用选定的 2 里拉或奖励卡换取 1 张奖励卡。费用不足时不能确认。",
        istanbulSmugglerTakeBtn: "走私者：用选定的 2 里拉或 1 件货物换取所选的 1 件货物；手推车容量仍有效。",
        istanbulRewardCardBtn: "领取 1 张奖励卡，然后将遇到的家族成员送回警察局。",
        istanbulRewardLiraBtn: "领取 3 里拉，然后将遇到的家族成员送回警察局。",
        istanbulDiceAcceptBtn: "接受这次骰子总和，继续结算。",
        istanbulDiceRerollBtn: "需拥有绿色清真寺板块，支付 2 里拉重掷骰子。",
        istanbulDicePlusBtn: "需拥有绿色清真寺板块，支付 2 里拉将骰子总和加 1。",
        istanbulCaravanDiscardBtn: "弃掉下拉框选中的 1 张奖励卡，完成商队旅馆行动。",
    };
    if (explanations[id]) return explanations[id];
    if (id?.includes("Skip")) return "跳过这次可选交易，不支付费用，继续回合。";
    if (id?.startsWith("istanbulMosque")) return "清真寺板块：支付对应颜色的 1 件货物，获得尚未拥有且仍可领取的板块。家族行动中先选择，再 Send Family 确认。";
    if (id?.startsWith("istanbulRedReturn")) return "红色清真寺能力：支付 2 里拉，将这个地点的 1 名自己的助手召回。";
    return `${button.textContent.trim()}：${button.disabled ? "当前条件不足，查看行动区说明或调整选择。" : "选择或确认此操作。"}`;
}

function decorateIstanbulHints(view) {
    if (!istanbulGamePanel) return;
    const meaning = "💰 里拉是钱；💎 红宝石用于获胜；📦 是每色货物容量；👥 是助手；🎴 是奖励卡；🔴 布料、🟢 香料、🟡 水果、🔵 珠宝是货物。";
    const add = (node, text) => { if (node) node.dataset.istanbulTip = text; };
    istanbulGamePanel.querySelectorAll(".istanbul-stat").forEach(node => add(node, `${node.textContent.trim()}。${meaning}移动模式决定可走格数；当前行动者完成本回合后才轮到下一位。`));
    istanbulGamePanel.querySelectorAll(".istanbul-player-row > div:not(.istanbul-player-name), .istanbul-market-card > div:not(.istanbul-market-title):not(.istanbul-mini-table), .istanbul-mosque-ability, .istanbul-mosque-rubies, .istanbul-post-row, .istanbul-mini-table span").forEach(node => add(node, `${node.textContent.trim()}。${meaning}市场表格表示出售件数对应的里拉收入；邮局高亮行表示当前可领取的资源。`));
    istanbulGamePanel.querySelectorAll(".istanbul-mosque-tile").forEach(node => add(node, `${node.textContent} 清真寺板块：${node.classList.contains("owned") ? "你已拥有" : node.classList.contains("taken") ? "此项未拥有或已不可领取" : "目前可领取"}。红色可付费召回助手；绿色可付费调整骰子；黄色让家族被送回时得钱；蓝色增加助手。`));
    istanbulGamePanel.querySelectorAll(".istanbul-good-stepper").forEach((row,i) => {
        const color = GOODS[i];
        add(row.querySelector("span"), `${ISTANBUL_GOOD_NAMES[color]}。${ISTANBUL_GOOD_HELP}此行数字为选择出售的件数。`);
        const controls = row.querySelectorAll("button");
        controls.forEach((button,index) => {
            button.id = `istanbulMarket${color}${index ? "Plus" : "Minus"}`;
            button.setAttribute("aria-label", `${index ? "增加" : "减少"}出售${ISTANBUL_GOOD_NAMES[color]}`);
            button.dataset.istanbulExplain = `${index ? "增加" : "减少"}出售 1 件${ISTANBUL_GOOD_NAMES[color]}。不能超出持有数量、市场需求或总共 5 件的限制。`;
        });
    });
    istanbulGamePanel.querySelectorAll("select").forEach((node,index) => {
        node.setAttribute("aria-label", node.getAttribute("aria-label") || `行动选项 ${index+1}：${node.options[node.selectedIndex]?.textContent || "选择"}`);
    });
    istanbulGamePanel.querySelectorAll(".istanbul-btn, .istanbul-bonus-card").forEach(button => {
        button.dataset.istanbulExplain ||= istanbulControlExplanation(button,view);
        if (button.closest(".istanbul-action-choice")) return;
        const wrap = document.createElement("span");
        wrap.className = "istanbul-action-choice";
        const info = document.createElement("button");
        info.type = "button";
        info.className = "istanbul-inline-info";
        info.textContent = "ⓘ";
        info.dataset.istanbulTip = button.dataset.istanbulExplain;
        info.setAttribute("aria-label", `${button.textContent.trim()}：说明`);
        button.before(wrap);
        wrap.append(button,info);
    });
    const pending = view.pending;
    const player = getViewer(view);
    if (pending?.type === "governor") {
        const take = document.getElementById("istanbulGovTakeBtn");
        if (take) take.disabled = istanbulSelections.governorPayment === "lira" ? player.lira < 2 : !player.bonus_hand.some(c => c.uid === istanbulSelections.governorPayment);
    }
    if (pending?.type === "smuggler") {
        const take = document.getElementById("istanbulSmugglerTakeBtn");
        if (take) take.disabled = istanbulSelections.smugglerPayment === "lira" ? player.lira < 2 : !(player.goods[istanbulSelections.smugglerPayment] > 0);
    }
    istanbulHints?.refresh();
}

istanbulHints = window.createIstanbulHints?.({panel: istanbulGamePanel, isExplaining: () => istanbulExplainMode, onExplain: istanbulExplainText});

// Explain isolates complete gestures, including the click following a disabled button's pointerdown.
let istanbulExplainGesture = false;
let istanbulExplainStart = null;
window.addEventListener("pointerdown", event => {
    istanbulExplainGesture = false;
    if (!istanbulExplainMode || !istanbulGamePanel?.contains(event.target) || event.target.closest("[data-istanbul-tip]")) return;
    istanbulExplainGesture = true;
    const target = event.target.closest("[data-istanbul-explain]");
    istanbulExplainStart = {x: event.clientX, y: event.clientY, text: target?.dataset.istanbulExplain};
    event.preventDefault();
    event.stopImmediatePropagation();
}, true);
window.addEventListener("pointerup", event => {
    if (!istanbulExplainGesture) return;
    const start = istanbulExplainStart;
    if (start?.text && Math.hypot(event.clientX-start.x,event.clientY-start.y) < 10) istanbulExplainText(start.text);
    event.preventDefault();
    event.stopImmediatePropagation();

}, true);
window.addEventListener("pointercancel", () => { istanbulExplainGesture = false; istanbulExplainStart = null; }, true);
window.addEventListener("click", event => {
    if (istanbulExplainGesture) {
        event.preventDefault();
        event.stopImmediatePropagation();
        istanbulExplainGesture = false;
        return;
    }
    if ((!istanbulExplainMode && !istanbulExplainGesture) || !istanbulGamePanel?.contains(event.target) || event.target.closest("[data-istanbul-tip]")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!istanbulExplainGesture) {
        const text = event.target.closest("[data-istanbul-explain]")?.dataset.istanbulExplain;
        if (text) istanbulExplainText(text);
    }
    istanbulExplainGesture = false;
}, true);
window.addEventListener("keydown", event => {
    istanbulExplainGesture = false;
    if (!istanbulGamePanel || istanbulGamePanel.classList.contains("hidden")) return;
    if (event.key !== "Escape") {
        if (istanbulExplainMode && istanbulGamePanel.contains(event.target) && [" ","Enter","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key) && !event.target.closest("[data-istanbul-tip]")) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if ([" ","Enter"].includes(event.key)) {
                const text = event.target.closest("[data-istanbul-explain]")?.dataset.istanbulExplain;
                if (text) istanbulExplainText(text);
            }
        }
        return;
    }
    if (!istanbulHelpModal.classList.contains("hidden")) { closeIstanbulHelpModal(); return; }
    if (!istanbulExplainModal.classList.contains("hidden")) { closeIstanbulExplainModal(); return; }
    if (istanbulExplainMode) { exitIstanbulExplainMode(); return; }
    if (closeIstanbulOverlays()) return;
    if (!currentIstanbulView) return;
    istanbulSelections.path = [];
    istanbulSelections.familyDestination = null;
    istanbulSelections.bonusCardId = null;
    istanbulInspectedPos = null;
    renderIstanbulGameState({view: currentIstanbulView});
});
for (const [modal, close] of [[istanbulHelpModal,closeIstanbulHelpModal],[istanbulExplainModal,closeIstanbulExplainModal]]) {
    modal?.addEventListener("click", event => { if (event.target === modal) close(); });
}


Object.assign(window, { renderIstanbulGameState, clearIstanbulState, showIstanbulHeaderActions });
})();
