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

const BONUS_LABELS = {
  BC_GOOD: "Gain 1 Good 🔴/🟢/🟡/🔵",
  BC_LIRA5: "Take 5 Lira💰",
  BC_SULTAN_2X: "Sultan Action x2",
  BC_POST_2X: "Post Office x2",
  BC_GEM_2X: "Gem Dealer x2",
  BC_FAMILY_POLICE_REWARD: "Send Family to Police",
  BC_NO_MOVE: "No Movement",
  BC_MOVE_3_4: "Move 3-4",
  BC_RETURN_ASSISTANT: "Return Assistant",
  BC_SMALL_MARKET_WILD: "Small Market Wild",
};

const PLAYER_COLORS = ["#d97706", "#0f766e", "#b91c1c", "#2563eb", "#7c3aed"];

const ISTANBUL_HELP_TEXT = `
<h3>Goal</h3>
<p>Be the first merchant to collect the required number of Rubies💎 (5 in 3-5 players, 6 in 2 players).</p>

<h3>Turn Flow</h3>
<ul>
  <li><strong>Move</strong> 1-2 spaces orthogonally (or use a bonus card to change this).</li>
  <li><strong>Encounters</strong> with other merchants (pay 2 Lira💰 each, except Fountain).</li>
  <li><strong>Assistant</strong> drop or pick up to activate the place.</li>
  <li><strong>Place Action</strong> (market, warehouse, palace, etc.).</li>
  <li><strong>Encounters</strong> with family, Governor, Smuggler.</li>
</ul>

<h3>Encounters & NPCs</h3>
<ul>
  <li><strong>Governor (G)</strong>: you may take 1 bonus card 🎴 by paying 2💰 or discarding 1🎴. If you take it, the Governor moves to the tile matching a dice roll (🟢 mosque can reroll / +1 for 2💰).</li>
  <li><strong>Smuggler (S)</strong>: you may take 1 good 🔴/🟢/🟡/🔵 by paying 2💰 or discarding 1🔴/🟢/🟡/🔵. If you take it, the Smuggler moves to the tile matching a dice roll (🟢 mosque can reroll / +1 for 2💰).</li>
  <li><strong>Family encounter</strong>: if you land on another player's family, choose 1 reward: 1🎴 or 3💰. Their family returns to Police Station. If they own 🟡 mosque tile, they gain +2💰.</li>
</ul>

<h3>Family & Police Station</h3>
<ul>
  <li>Your family starts at the Police Station.</li>
  <li>If your family is at the Police Station, you may send it to any place and perform that place's action (no encounters). The family stays there afterward.</li>
  <li>Your family returns to the Police Station when another player meets it and takes the reward, or when you play the “Send Family to Police” bonus card.</li>
</ul>

<h3>Goods 🔴/🟢/🟡/🔵</h3>
<p>Goods 🔴/🟢/🟡/🔵 are tracked by color. Use warehouses to fill up to your cart capacity. Trade at markets for Lira💰.</p>

<h3>Rubies💎</h3>
<ul>
  <li><strong>Sultan's Palace</strong>: pay goods 🔴/🟢/🟡/🔵 based on the track.</li>
  <li><strong>Gemstone Dealer</strong>: pay Lira💰 based on the track.</li>
  <li><strong>Mosques</strong>: collect matching tiles for bonus Ruby💎.</li>
</ul>

<h3>Bonus Cards 🎴</h3>
<p>Bonus cards can be played before or after actions (see the card text). Use them to bend the rules and gain tempo.</p>
`;

const ISTANBUL_BUTTON_EXPLANATIONS = {
  istanbulMoveBtn: {
    name: "Move",
    description: "Send your merchant along the selected path (1-2 steps normally, or 3-4 / 0 with a bonus).",
    cost: "Movement",
    costType: "free",
  },
  istanbulDropBtn: {
    name: "Drop Assistant",
    description: "Leave the bottom assistant at this place to activate the action.",
    cost: "Assistant",
    costType: "free",
  },
  istanbulPickBtn: {
    name: "Pick Assistant",
    description: "Pick up your assistant from this place so they rejoin your stack.",
    cost: "Assistant",
    costType: "free",
  },
  istanbulSkipBtn: {
    name: "Skip Assistant",
    description: "Skip assistant handling at the Fountain if you cannot drop or pick.",
    cost: "Assistant",
    costType: "free",
  },
  istanbulActionBtn: {
    name: "Do Place Action",
    description: "Carry out the action of the current place (market, warehouse, palace, etc.).",
    cost: "Action",
    costType: "free",
  },
  istanbulBonusPlayBtn: {
    name: "Play Bonus",
    description: "Play the selected bonus card. Some cards require extra choices.",
    cost: "Bonus",
    costType: "free",
  },
};

const ISTANBUL_TILE_EXPLANATIONS = {
  1: {
    name: "Wainwright",
    description: "Pay 7 Lira💰 to increase your cart capacity by 1 (max 5). The first player to reach 5 gains a Ruby💎.",
    cost: "7 Lira💰",
    costType: "pay",
  },
  2: {
    name: "Fabric Warehouse",
    description: "Fill your red goods 🔴 to cart capacity.",
    cost: "Free",
    costType: "free",
  },
  3: {
    name: "Spice Warehouse",
    description: "Fill your green goods 🟢 to cart capacity.",
    cost: "Free",
    costType: "free",
  },
  4: {
    name: "Fruit Warehouse",
    description: "Fill your yellow goods 🟡 to cart capacity.",
    cost: "Free",
    costType: "free",
  },
  5: {
    name: "Post Office",
    description: "Take the resources in the current row, then advance the mail indicator.",
    cost: "Free",
    costType: "free",
  },
  6: {
    name: "Caravansary",
    description: "Draw 2 bonus cards, then discard 1 from your hand.",
    cost: "Free",
    costType: "free",
  },
  7: {
    name: "Fountain",
    description: "Recall any number of your assistants from the board.",
    cost: "Free",
    costType: "free",
  },
  8: {
    name: "Black Market",
    description: "Gain 1🔴/1🟢/1🟡, then roll to gain blue goods 🔵 (7-8:1🔵, 9-10:2🔵, 11-12:3🔵).",
    cost: "Free",
    costType: "free",
  },
  9: {
    name: "Tea House",
    description: "Call 3-12 and roll. If roll >= call, gain that many Lira💰; otherwise gain 2 Lira💰.",
    cost: "Free",
    costType: "free",
  },
  10: {
    name: "Large Market",
    description: "Sell 1-5 goods 🔴/🟢/🟡/🔵 matching the demand tile for Lira💰, then cycle the tile.",
    cost: "1-5🔴/🟢/🟡/🔵",
    costType: "pay",
  },
  11: {
    name: "Small Market",
    description: "Sell 1-5 goods 🔴/🟢/🟡/🔵 matching the demand tile for Lira💰, then cycle the tile.",
    cost: "1-5🔴/🟢/🟡/🔵",
    costType: "pay",
  },
  12: {
    name: "Police Station",
    description: "If your family is here, send them to any place and perform that place's action.",
    cost: "Free",
    costType: "free",
  },
  13: {
    name: "Sultan's Palace",
    description: "Pay the current goods requirement 🔴/🟢/🟡/🔵 to gain a Ruby💎; the requirement increases afterward.",
    cost: "Goods 🔴/🟢/🟡/🔵",
    costType: "pay",
  },
  14: {
    name: "Gemstone Dealer",
    description: "Pay the current Lira💰 cost to gain a Ruby💎; the cost increases afterward.",
    cost: "Lira💰",
    costType: "pay",
  },
  15: {
    name: "Small Mosque",
    description: "Pay 1🔴 or 1🟢 good to take the matching mosque tile (and its power).",
    cost: "1🔴/1🟢",
    costType: "pay",
  },
  16: {
    name: "Great Mosque",
    description: "Pay 1🟡 or 1🔵 good to take the matching mosque tile (and its power).",
    cost: "1🟡/1🔵",
    costType: "pay",
  },
};

const ISTANBUL_TILE_SUMMARY = {
  1: "7💰->+1📦",
  2: "+🔴->📦",
  3: "+🟢->📦",
  4: "+🟡->📦",
  5: "Mail row->📬+1",
  6: "+2🎴-1🎴",
  7: "Recall 👥",
  8: "+1(🔴/🟢/🟡)+🎲🔵",
  9: "Call X(3-12)=>🎲,✅+X,❎+2",
  10: "Goto 🛒,🔴🟢🟡🔵=>💰",
  11: "Goto 🛒,🔴🟢🟡🔵=>💰",
  12: "👪->Any action",
  13: "Goods🔴/🟢/🟡/🔵->💎",
  14: "💰->💎",
  15: "🔴/🟢->🕌",
  16: "🟡/🔵->🕌",
};

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
let istanbulActiveOverlay = null;

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
  istanbulLastPhase = null;
  istanbulLastTurn = null;
  resetIstanbulSelections();
  closeIstanbulOverlays();
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
  if (istanbulHeaderActions) {
    istanbulHeaderActions.style.display = show ? "flex" : "none";
  }
}

function showIstanbulHelpModal() {
  if (!istanbulHelpModal || !istanbulHelpContent) return;
  istanbulHelpContent.innerHTML = ISTANBUL_HELP_TEXT;
  setModalVisible(istanbulHelpModal, true);
}

function closeIstanbulHelpModal() {
  if (!istanbulHelpModal) return;
  setModalVisible(istanbulHelpModal, false);
}

function updateIstanbulExplainClasses(enabled) {
  Object.keys(ISTANBUL_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll(".istanbul-tile").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
  document.querySelectorAll(".istanbul-mosque-rubies").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
}

function findIstanbulButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(ISTANBUL_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleIstanbulExplainMode() {
  istanbulExplainMode = !istanbulExplainMode;
  document.body.classList.toggle("istanbul-explain-mode", istanbulExplainMode);
  updateIstanbulExplainClasses(istanbulExplainMode);
  if (istanbulExplainBtn) {
    istanbulExplainBtn.classList.toggle("active", istanbulExplainMode);
  }
}

function exitIstanbulExplainMode() {
  if (!istanbulExplainMode) return;
  istanbulExplainMode = false;
  document.body.classList.remove("istanbul-explain-mode");
  updateIstanbulExplainClasses(false);
  if (istanbulExplainBtn) {
    istanbulExplainBtn.classList.remove("active");
  }
}

function showIstanbulButtonExplanation(buttonId) {
  const explanation = ISTANBUL_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !istanbulExplainContent || !istanbulExplainModal) return;
  let costClass = "free";
  if (explanation.costType === "pay") costClass = "pay";
  if (explanation.costType === "end") costClass = "end";
  istanbulExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    <span class="istanbul-explain-cost ${costClass}">${explanation.cost}</span>
  `;
  setModalVisible(istanbulExplainModal, true);
}

function showIstanbulTileExplanation(placeId, pos) {
  const explanation = ISTANBUL_TILE_EXPLANATIONS[placeId];
  if (!explanation || !istanbulExplainContent || !istanbulExplainModal) {
    return;
  }
  const tokenLines = [];
  const view = currentIstanbulView || {};
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    if (player.merchant_pos === pos) {
      const name = player.name || player.player_id || "Merchant";
      const label = name.slice(0, 1).toUpperCase();
      tokenLines.push(`🧿 Merchant: ${name} (${label})`);
    }
    if (player.family_pos === pos) {
      const name = player.name || player.player_id || "Family";
      tokenLines.push(`👪 Family: ${name} (F)`);
    }
  });
  if (view.npc && view.npc.governor === pos) {
    tokenLines.push("🟣 Governor (G)");
  }
  if (view.npc && view.npc.smuggler === pos) {
    tokenLines.push("⚫ Smuggler (S)");
  }
  const tokensHtml = tokenLines.length
    ? `<div><strong>Tokens Here</strong><ul>${tokenLines.map((line) => `<li>${line}</li>`).join("")}</ul></div>`
    : "<div><strong>Tokens Here</strong><div>None</div></div>";

  let costClass = "free";
  if (explanation.costType === "pay") costClass = "pay";
  if (explanation.costType === "end") costClass = "end";
  istanbulExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    <span class="istanbul-explain-cost ${costClass}">${explanation.cost}</span>
    ${tokensHtml}
  `;
  setModalVisible(istanbulExplainModal, true);
}

function showIstanbulMosqueRubyExplanation(groupKey) {
  if (!istanbulExplainContent || !istanbulExplainModal) return;
  const view = currentIstanbulView || {};
  const mosques = view.mosques || {};
  const count = mosques[groupKey] ? mosques[groupKey].rubies : null;
  const label = groupKey === "small" ? "Small Mosque" : "Great Mosque";
  const remaining = Number.isInteger(count) ? count : 0;
  istanbulExplainContent.innerHTML = `
    <h4>${label} Bonus Rubies</h4>
    <p>This pool rewards players who collect both tiles from this mosque. When you own both colors, take 1💎 from here.</p>
    <span class="istanbul-explain-cost free">Remaining: 💎 ${remaining}</span>
  `;
  setModalVisible(istanbulExplainModal, true);
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
    return `${count}${GOOD_LABELS[color]}`;
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
  if (istanbulLastPhase && istanbulLastPhase !== view.phase) {
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

function renderIstanbulGameState(data) {
  const view = data.view || {};
  currentIstanbulView = view;
  clearSelectionIfNeeded(view);
  if (istanbulPhaseLabel) istanbulPhaseLabel.textContent = view.phase || "-";
  if (istanbulTurnLabel) istanbulTurnLabel.textContent = formatPlayerName(view, view.current_player);
  if (istanbulMoveModeLabel) istanbulMoveModeLabel.textContent = view.movement_mode || "-";
  if (istanbulWinTargetLabel) istanbulWinTargetLabel.textContent = view.rubies_to_win || "-";
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
  renderIstanbulActionCenter(view);
  updateIstanbulExplainClasses(istanbulExplainMode);
}

function renderIstanbulBoard(view) {
  if (!istanbulBoard) return;
  istanbulBoard.innerHTML = "";
  const viewer = getViewer(view);
  const board = (view.board || []).slice().sort((a, b) => a.row - b.row || a.col - b.col);
  const neighbors = buildNeighborMap(view);
  const path = istanbulSelections.path || [];
  const familyTarget = istanbulSelections.familyDestination;

  board.forEach((tile) => {
    const tileEl = document.createElement("button");
    tileEl.type = "button";
    tileEl.className = "istanbul-tile";
    tileEl.dataset.pos = tile.pos;
    tileEl.dataset.placeId = tile.place_id;
    if (istanbulExplainMode) {
      tileEl.classList.add("has-explanation");
    }
    if (viewer && viewer.merchant_pos === tile.pos) {
      tileEl.classList.add("current");
    }
    if (path.includes(tile.pos)) {
      tileEl.classList.add("path-step");
      const step = document.createElement("div");
      step.className = "istanbul-step-badge";
      step.textContent = String(path.indexOf(tile.pos) + 1);
      tileEl.appendChild(step);
    }
    if (familyTarget === tile.pos) {
      tileEl.classList.add("family-target");
    }

    const header = document.createElement("div");
    header.className = "istanbul-tile-header";
    const idLabel = document.createElement("div");
    idLabel.textContent = `#${tile.place_id}`;
    const diceLabel = document.createElement("div");
    diceLabel.className = "istanbul-tile-dice";
    diceLabel.textContent = tile.dice ? `🎲 ${tile.dice}` : "";
    header.appendChild(idLabel);
    header.appendChild(diceLabel);

    const name = document.createElement("div");
    name.className = "istanbul-tile-name";
    name.textContent = tile.name || "-";

    const summary = ISTANBUL_TILE_SUMMARY[tile.place_id];
    let desc = null;
    if (summary) {
      desc = document.createElement("div");
      desc.className = "istanbul-tile-desc";
      desc.textContent = summary;
    }

    const tokenRow = document.createElement("div");
    tokenRow.className = "istanbul-token-row";

    (view.players || []).forEach((player) => {
      if (player.merchant_pos === tile.pos) {
        const token = document.createElement("div");
        token.className = "istanbul-token";
        const seat = Number.isInteger(player.seat) ? player.seat : 0;
        token.style.background = PLAYER_COLORS[seat % PLAYER_COLORS.length];
        const name = player.name || "P";
        token.textContent = name.slice(0, 1).toUpperCase();
        token.title = `${name} Merchant`;
        tokenRow.appendChild(token);
      }
      if (player.family_pos === tile.pos) {
        const fam = document.createElement("div");
        fam.className = "istanbul-token family";
        const name = player.name || "F";
        fam.textContent = "F";
        fam.title = `${name} Family`;
        tokenRow.appendChild(fam);
      }
    });

    if (view.npc && view.npc.governor === tile.pos) {
      const gov = document.createElement("div");
      gov.className = "istanbul-token npc";
      gov.textContent = "G";
      gov.title = "Governor";
      tokenRow.appendChild(gov);
    }
    if (view.npc && view.npc.smuggler === tile.pos) {
      const sm = document.createElement("div");
      sm.className = "istanbul-token smuggler";
      sm.textContent = "S";
      sm.title = "Smuggler";
      tokenRow.appendChild(sm);
    }

    tileEl.appendChild(header);
    tileEl.appendChild(name);
    if (desc) {
      tileEl.appendChild(desc);
    }
    tileEl.appendChild(tokenRow);

    tileEl.addEventListener("click", () => {
      if (!selectionIsViewerTurn(view)) return;
      if (view.phase === "movement" && view.legal_actions && view.legal_actions.includes("move")) {
        updatePathSelection(view, tile.pos, neighbors);
        renderIstanbulGameState({ view });
        return;
      }
      const viewer = getViewer(view);
      const tileInfo = getTileByPos(view, viewer ? viewer.merchant_pos : null);
      if (view.phase === "action" && tileInfo && tileInfo.place_id === 12 && viewer && viewer.family_pos === tileInfo.pos) {
        istanbulSelections.familyDestination = tile.pos;
        renderIstanbulGameState({ view });
      }
    });

    istanbulBoard.appendChild(tileEl);
  });
}

function updatePathSelection(view, pos, neighbors) {
  const viewer = getViewer(view);
  if (!viewer) return;
  const start = viewer.merchant_pos;
  if (pos === start) return;
  const path = istanbulSelections.path || [];
  const limits = movementLimits(view.movement_mode || "normal");
  if (path.length >= limits.max) {
    return;
  }
  if (path.length === 0) {
    if (neighbors.get(start).includes(pos)) {
      istanbulSelections.path = [pos];
    }
    return;
  }
  const last = path[path.length - 1];
  if (pos === last) {
    istanbulSelections.path = path.slice(0, -1);
    return;
  }
  const existingIndex = path.indexOf(pos);
  if (existingIndex >= 0) {
    istanbulSelections.path = path.slice(0, existingIndex + 1);
    return;
  }
  if (neighbors.get(last).includes(pos)) {
    istanbulSelections.path = [...path, pos];
  }
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
  const viewer = getViewer(view);
  if (!viewer) {
    istanbulYou.innerHTML = "";
    return;
  }
  const items = [];
  items.push(`<div class="istanbul-pill">Lira💰 ${viewer.lira}</div>`);
  items.push(`<div class="istanbul-pill">Rubies💎 ${viewer.rubies}</div>`);
  items.push(`<div class="istanbul-pill">Cart📦 ${viewer.capacity}</div>`);
  items.push(`<div class="istanbul-pill">Assistants👥 ${viewer.assistants_in_stack}/${viewer.assistants_on_board.length}</div>`);
  const goodsLine = `<div>${formatGoodsLine(viewer.goods || {})}</div>`;
  istanbulYou.innerHTML = items.join("") + goodsLine;
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
    text.textContent = card.text || "";
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

  if (!selectionIsViewerTurn(view)) {
    istanbulActionHint.textContent = "Waiting for other players.";
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
    istanbulActionHint.textContent = "Family captured. Choose a reward.";
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
    istanbulActionHint.textContent = "Governor: draw a bonus card?";
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
    istanbulActionHint.textContent = "Smuggler: gain a good 🔴/🟢/🟡/🔵?";
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
    paySelect.value = istanbulSelections.smugglerPayment === "good" ? "good" : "lira";
    paySelect.addEventListener("change", () => {
      if (paySelect.value === "lira") {
        istanbulSelections.smugglerPayment = "lira";
      } else {
        istanbulSelections.smugglerPayment = istanbulSelections.smugglerPayment === "lira" ? "red" : istanbulSelections.smugglerPayment;
      }
      renderIstanbulGameState({ view });
    });
    opts.appendChild(goodSelect);
    opts.appendChild(paySelect);
    if (istanbulSelections.smugglerPayment !== "lira") {
      const payGood = buildGoodSelect(
        istanbulSelections.smugglerPayment,
        (value) => {
          istanbulSelections.smugglerPayment = value;
        },
        false
      );
      opts.appendChild(payGood);
    }
    istanbulActionControls.appendChild(opts);
    return;
  }
  if (type === "dice") {
    istanbulActionHint.textContent = `Dice roll: ${pending.roll}`;
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
    istanbulActionHint.textContent = "Discard a bonus card.";
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
  istanbulActionHint.textContent = "Select a path by clicking tiles.";
  const mode = view.movement_mode || "normal";
  if (mode === "stay" && istanbulSelections.path.length) {
    istanbulSelections.path = [];
  }
  const steps = istanbulSelections.path.length;
  const limits = movementLimits(mode);
  const isValid = steps >= limits.min && steps <= limits.max;
  if (istanbulPathHint) {
    const pathText = steps ? istanbulSelections.path.join(" → ") : "-";
    istanbulPathHint.textContent = `Path: ${pathText}`;
  }
  const moveBtn = buildButton("Move", "istanbulMoveBtn", () => {
    sendAction({ type: "move", path: istanbulSelections.path });
  }, "primary", !isValid);
  istanbulActionControls.appendChild(moveBtn);
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
  istanbulActionHint.textContent = isFountain ? "You are at the Fountain." : "Manage your assistant.";

  const row = document.createElement("div");
  row.className = "istanbul-control-row";
  row.appendChild(buildButton("Drop Assistant", "istanbulDropBtn", () => sendAction({ type: "assistant", mode: "drop" }), "primary", !canDrop));
  row.appendChild(buildButton("Pick Assistant", "istanbulPickBtn", () => sendAction({ type: "assistant", mode: "pickup" }), "secondary", !canPick));
  if (isFountain) {
    row.appendChild(buildButton("Skip", "istanbulSkipBtn", () => sendAction({ type: "assistant", mode: "none" }), "ghost", !( !canDrop && !canPick )));
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
  istanbulActionHint.textContent = tile.name || "Place action";

  if (placeType === "wainwright") {
    const canPay = viewer.lira >= 7 && viewer.capacity < 5;
    const btn = buildButton("Upgrade Cart📦 (7 Lira💰)", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary", !canPay);
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "warehouse") {
    const btn = buildButton("Fill to Capacity", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "post_office") {
    const btn = buildButton("Collect Mail", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "caravansary") {
    const btn = buildButton("Draw 2 Bonus Cards", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
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
    const btn = buildButton("Buy Ruby💎", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
    istanbulActionControls.appendChild(btn);
  } else if (placeType === "gemstone_dealer") {
    const btn = buildButton("Buy Ruby💎", "istanbulActionBtn", () => sendAction({ type: "location_action" }), "primary");
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
    note.textContent = "Family is not at the Police Station.";
    istanbulActionControls.appendChild(note);
    renderBonusPlay(view);
    return;
  }
  istanbulActionHint.textContent = "Select a destination tile for your family.";
  const dest = istanbulSelections.familyDestination;
  const destTile = dest !== null ? getTileByPos(view, dest) : null;
  const row = document.createElement("div");
  row.className = "istanbul-control-row";
  const label = document.createElement("div");
  label.textContent = destTile ? `Destination: ${destTile.name}` : "Destination: none";
  row.appendChild(label);
  istanbulActionControls.appendChild(row);

  if (destTile) {
    renderFamilyDestinationControls(view, destTile);
    const sendBtn = buildButton("Send Family", "istanbulFamilySendBtn", () => {
      const payload = buildFamilyPayload(destTile);
      sendAction(payload);
    }, "primary");
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
  info.textContent = isFamily ? "Choose assistants to recall (blank = all)." : "Recall any assistants.";
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
    const btn = buildButton("Recall Assistants👥", "istanbulActionBtn", () => {
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
    const btn = buildButton("Trade Goods 🔴/🟢/🟡/🔵", "istanbulActionBtn", () => {
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
  input.min = "3";
  input.max = "12";
  input.value = istanbulSelections.teaTarget;
  input.addEventListener("change", () => {
    const value = parseInt(input.value, 10);
    if (Number.isInteger(value)) {
      istanbulSelections.teaTarget = Math.max(3, Math.min(12, value));
    }
  });
  row.appendChild(input);
  istanbulActionControls.appendChild(row);
  if (!isFamily) {
    const btn = buildButton("Gamble", "istanbulActionBtn", () => {
      sendAction({ type: "location_action", target: istanbulSelections.teaTarget });
    }, "primary");
    istanbulActionControls.appendChild(btn);
  }
}

function renderMarketControls(view, placeType, isFamily) {
  const marketKey = placeType === "market_large" ? "market_large" : "market_small";
  const market = view[marketKey] || {};
  const demand = market.current ? market.current.goods || {} : {};
  const allowWild = placeType === "market_small" && view.small_market_wild;
  clampMarketGoods(view, demand, allowWild);

  const demandLine = document.createElement("div");
  demandLine.textContent = `Demand: ${formatGoodsLine(demand)}`;
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
    label.textContent = GOOD_LABELS[color];
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
    const viewer = getViewer(view);
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
    summary.textContent = `Selected: ${total} goods 🔴/🟢/🟡/🔵 => ${payout} Lira💰`;
    istanbulActionControls.appendChild(summary);
  }
  if (!isFamily) {
    const sellBtn = buildButton("Sell Goods 🔴/🟢/🟡/🔵", "istanbulActionBtn", () => {
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
  options.forEach((color) => {
    const available = view.mosques && view.mosques[mosqueKey] ? view.mosques[mosqueKey][color] : true;
    const hasGood = viewer && viewer.goods ? viewer.goods[color] > 0 : false;
    const disabled = !available || !hasGood;
    const btn = buildButton(GOOD_LABELS[color], `istanbulMosque${color}Btn`, () => {
      istanbulSelections.mosqueColor = color;
      if (!isFamily) {
        sendAction({ type: "location_action", color });
      }
    }, "secondary", disabled);
    row.appendChild(btn);
  });
  istanbulActionControls.appendChild(row);
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
    option.textContent = GOOD_LABELS[color];
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
      event.target.closest("button") ||
      event.target.closest("input") ||
      event.target.closest("select") ||
      event.target.closest("textarea") ||
      event.target.closest(".istanbul-overlay-card") ||
      event.target.closest(".istanbul-tile")
    ) {
      return;
    }
    istanbulSelections.path = [];
    istanbulSelections.bonusCardId = null;
    istanbulSelections.familyDestination = null;
    renderIstanbulGameState({ view: currentIstanbulView });
  });
}

// Explain mode handling
if (document) {
  document.addEventListener("pointerdown", (e) => {
    if (!istanbulExplainMode) return;
    const mosqueRubies = e.target.closest(".istanbul-mosque-rubies");
    if (mosqueRubies) {
      const key = mosqueRubies.dataset.mosque;
      showIstanbulMosqueRubyExplanation(key);
      e.preventDefault();
      e.stopPropagation();
      exitIstanbulExplainMode();
      return;
    }
    const tile = e.target.closest(".istanbul-tile");
    if (tile) {
      const placeId = Number(tile.dataset.placeId);
      const pos = Number(tile.dataset.pos);
      showIstanbulTileExplanation(placeId, pos);
      e.preventDefault();
      e.stopPropagation();
      exitIstanbulExplainMode();
      return;
    }
    const buttonId = findIstanbulButtonAtPoint(e.clientX, e.clientY);
    if (buttonId) {
      e.preventDefault();
      e.stopPropagation();
      showIstanbulButtonExplanation(buttonId);
      exitIstanbulExplainMode();
      return;
    }
    const button = e.target.closest("button");
    if (button === istanbulExplainBtn || button === istanbulHelpBtn) return;
    if (button === istanbulHelpModalCloseBtn || button === istanbulExplainModalCloseBtn) return;
    if (button) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener("click", (e) => {
    if (!istanbulExplainMode) return;
    if (e.target.closest(".istanbul-tile")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const button = e.target.closest("button");
    if (!button) return;
    if (button === istanbulExplainBtn || button === istanbulHelpBtn) return;
    if (button === istanbulHelpModalCloseBtn || button === istanbulExplainModalCloseBtn) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (closeIstanbulOverlays()) {
        e.preventDefault();
        return;
      }
      if (istanbulExplainMode) {
        exitIstanbulExplainMode();
        return;
      }
      if (istanbulHelpModal && !istanbulHelpModal.classList.contains("hidden")) {
        e.preventDefault();
        closeIstanbulHelpModal();
      }
      if (istanbulExplainModal && !istanbulExplainModal.classList.contains("hidden")) {
        e.preventDefault();
        closeIstanbulExplainModal();
      }
    }
  });
}
