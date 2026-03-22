let currentManilaView = null;
let manilaSelectedCargo = [];
let manilaCycleOpen = false;
let manilaCycleUserOverride = null;
let manilaLastPhase = null;
let manilaTooltipTimer = null;
let manilaErrorListenerBound = false;

const manilaPhaseLabel = document.getElementById("manilaPhase");
const manilaRoundLabel = document.getElementById("manilaRound");
const manilaCurrentLabel = document.getElementById("manilaCurrent");
const manilaHarborLabel = document.getElementById("manilaHarbor");
const manilaHarborBidLabel = document.getElementById("manilaHarborBid");
const manilaPricesLabel = document.getElementById("manilaPrices");
const manilaBoats = document.getElementById("manilaBoats");
const manilaDiceBar = document.getElementById("manilaDiceBar");
const manilaBoard = document.getElementById("manilaBoard");
const manilaPlayers = document.getElementById("manilaPlayers");
const manilaLegalActions = document.getElementById("manilaLegalActions");
const manilaTooltip = document.getElementById("manilaTooltip");

const manilaAuctionInfo = document.getElementById("manilaAuctionInfo");
const manilaAuctionBidList = document.getElementById("manilaAuctionBidList");
const manilaBidInput = document.getElementById("manilaBidInput");
const manilaBidBtn = document.getElementById("manilaBidBtn");
const manilaPassBidBtn = document.getElementById("manilaPassBidBtn");
const manilaPledgeSelect = document.getElementById("manilaPledgeSelect");
const manilaPledgeBtn = document.getElementById("manilaPledgeBtn");

const manilaBuyStockGroup = document.getElementById("manilaBuyStockGroup");
const manilaBuyStockButtons = document.getElementById("manilaBuyStockButtons");
const manilaSkipBuyBtn = document.getElementById("manilaSkipBuyBtn");

const manilaSelectCargoGroup = document.getElementById("manilaSelectCargoGroup");
const manilaSelectCargoButtons = document.getElementById("manilaSelectCargoButtons");
const manilaConfirmCargoBtn = document.getElementById("manilaConfirmCargoBtn");
const manilaResetCargoBtn = document.getElementById("manilaResetCargoBtn");

const manilaPositionsGroup = document.getElementById("manilaPositionsGroup");
const manilaPositionsWrap = document.getElementById("manilaPositionsWrap");
const manilaPositionsSum = document.getElementById("manilaPositionsSum");
const manilaConfirmPositionsBtn = document.getElementById("manilaConfirmPositionsBtn");

const manilaPassFacility = document.getElementById("manilaPassFacility");
const manilaPassBtn = document.getElementById("manilaPassBtn");

const manilaPilotGroup = document.getElementById("manilaPilotGroup");
const manilaPilotRows = document.getElementById("manilaPilotRows");

const manilaPirateGroup = document.getElementById("manilaPirateGroup");
const manilaPirateRole = document.getElementById("manilaPirateRole");
const manilaPirateTargetSelect = document.getElementById("manilaPirateTargetSelect");
const manilaPirateResultSelect = document.getElementById("manilaPirateResultSelect");
const manilaPirateBoardBtn = document.getElementById("manilaPirateBoardBtn");
const manilaPiratePlunderBtn = document.getElementById("manilaPiratePlunderBtn");
const manilaPirateSkipBtn = document.getElementById("manilaPirateSkipBtn");

const manilaCycleModal = document.getElementById("manilaCycleModal");
const manilaCycleToggleBtn = document.getElementById("manilaCycleToggleBtn");
const manilaCycleCloseBtn = document.getElementById("manilaCycleCloseBtn");
const manilaCycleExplainBtn = document.getElementById("manilaCycleExplainBtn");
const manilaCycleStatus = document.getElementById("manilaCycleStatus");
const manilaCyclePhase = document.getElementById("manilaCyclePhase");
const manilaCycleRecap = document.getElementById("manilaCycleRecap");

const manilaPledgeGroup = document.getElementById("manilaPledgeGroup");

const manilaRoundEndPanel = document.getElementById("manilaRoundEndPanel");
const manilaRoundEndPlayers = document.getElementById("manilaRoundEndPlayers");
const manilaRoundEndStatus = document.getElementById("manilaRoundEndStatus");
const manilaNextRoundBtn = document.getElementById("manilaNextRoundBtn");

const manilaHeaderActions = document.getElementById("manilaHeaderActions");
const manilaHelpBtn = document.getElementById("manilaHelpBtn");
const manilaExplainBtn = document.getElementById("manilaExplainBtn");
const manilaHelpModal = document.getElementById("manilaHelpModal");
const manilaHelpModalCloseBtn = document.getElementById("manilaHelpModalCloseBtn");
const manilaExplainModal = document.getElementById("manilaExplainModal");
const manilaExplainModalCloseBtn = document.getElementById("manilaExplainModalCloseBtn");
const manilaExplainContent = document.getElementById("manilaExplainContent");

const MANILA_CARGO_ORDER = ["nutmeg", "silk", "ginseng", "jade"];

const MANILA_CARGO_META = {
  nutmeg: {
    label: "Nutmeg",
    icon: "🟫",
    accent: "nutmeg",
    totalValue: 24,
    seatCosts: [2, 3, 4],
  },
  silk: {
    label: "Silk",
    icon: "🟨",
    accent: "silk",
    totalValue: 18,
    seatCosts: [1, 2, 3],
  },
  ginseng: {
    label: "Ginseng",
    icon: "🟩",
    accent: "ginseng",
    totalValue: 36,
    seatCosts: [3, 4, 5, 5],
  },
  jade: {
    label: "Jade",
    icon: "🟦",
    accent: "jade",
    totalValue: 30,
    seatCosts: [3, 4, 5],
  },
};

const MANILA_BOARD_VALUES = {
  port: {
    A: { cost: 4, payout: 6 },
    B: { cost: 3, payout: 8 },
    C: { cost: 2, payout: 15 },
  },
  shipyard: {
    A: { cost: 4, payout: 6 },
    B: { cost: 3, payout: 8 },
    C: { cost: 2, payout: 15 },
  },
  pirates: { cost: 5 },
  pilots: { small: 2, big: 5 },
  insurance: { cost: 0, reward: 10 },
};

const MANILA_CYCLE_PHASES = new Set([
  "auction",
  "harbormaster_pay",
  "harbormaster_buy",
  "harbormaster_cargo",
  "harbormaster_position",
  "placement",
]);

const MANILA_DYNAMIC_EXPLANATIONS = {
  port: {
    name: "Port Slot",
    description: "Pays out when ships successfully reach port (based on arrival order).",
    cost: "🪙 Pay slot cost",
    costType: "pay",
  },
  shipyard: {
    name: "Shipyard Slot",
    description: "Pays out when ships fail to reach port (based on failure order).",
    cost: "🪙 Pay slot cost",
    costType: "pay",
  },
  pirate: {
    name: "Pirate Role",
    description: "Join pirates to board ships that hit port exactly on day 2, or plunder ships that hit port exactly on day 3. First player becomes Captain, second becomes Pirate.",
    cost: "🪙 Pay slot cost",
    costType: "pay",
  },
  pilot: {
    name: "Pilot Role",
    description: "Move ships forward before dice movement (big pilot can split).",
    cost: "🪙 Pay slot cost",
    costType: "pay",
  },
  insurance: {
    name: "Insurance Broker",
    description: "Gain immediate cash, then pay per failed ship this round.",
    cost: "🪙 Pay slot cost",
    costType: "pay",
  },
};

const MANILA_HELP_TEXT = `
<h3>Game Overview</h3>
<p>Manila is a wagering-and-placement game where players invest in cargo ships, place workers in harbor roles, and profit as ships (hopefully) reach port.</p>

<h3>Round Structure</h3>
<ol>
  <li><strong>Auction</strong> – Bid to become Harbormaster.</li>
  <li><strong>Harbormaster Setup</strong> – Optional stock buy, choose 3 cargo, set initial positions.</li>
  <li><strong>Placement (3 mini-rounds)</strong> – Place workers on ships, port, shipyard, pirate, pilot, insurance.</li>
  <li><strong>Movement & Resolve</strong> – Ships move by dice (with pilots/pirates), then payouts occur.</li>
</ol>

<h3>Key Ideas</h3>
<ul>
  <li><strong>Ship seats</strong> share profits when a ship arrives.</li>
  <li><strong>Port</strong> pays for successful ships; <strong>Shipyard</strong> pays for failures.</li>
  <li><strong>Arrival order</strong> fills Port A/B/C when ships move past space 13.</li>
  <li><strong>Pirates</strong> can board ships that hit port exactly on day 2, and plunder ships that hit port exactly on day 3.</li>
  <li><strong>Plundered ships</strong> still resolve to Port or Shipyard based on the Captain's choice.</li>
  <li><strong>Pilots</strong> can move ships forward (big pilot can split).</li>
  <li><strong>Insurance</strong> pays immediately but collects per failed ship.</li>
  <li><strong>Pledge Stock</strong> gives instant cash but costs more at final scoring.</li>
</ul>

<h3>Placement Tip</h3>
<p>During placement, click a dock slot or ship seat directly on the board/boats.</p>
`;

const MANILA_BUTTON_EXPLANATIONS = {
  manilaCycleToggleBtn: {
    name: "Harbormaster Panel",
    description: "Open or hide the Harbormaster cycle panel to review auction/setup actions.",
    cost: "Free",
    costType: "free",
  },
  manilaBidBtn: {
    name: "Bid",
    description: "Place a higher bid to become Harbormaster this round.",
    cost: "🪙 Pay bid if you win",
    costType: "pay",
  },
  manilaPassBidBtn: {
    name: "Pass",
    description: "Pass on the auction. You cannot bid again this round.",
    cost: "Free",
    costType: "free",
  },
  manilaPayBidBtn: {
    name: "Pay Bid",
    description: "Pay your winning bid to become Harbormaster and start setup.",
    cost: "🪙 Pay bid",
    costType: "pay",
  },
  manilaSkipBuyBtn: {
    name: "Skip Buy",
    description: "Skip the optional stock purchase and move to cargo selection.",
    cost: "Free",
    costType: "free",
  },
  manilaConfirmCargoBtn: {
    name: "Confirm Cargo",
    description: "Lock in the 3 cargo types that will sail this round.",
    cost: "Free",
    costType: "free",
  },
  manilaResetCargoBtn: {
    name: "Reset Cargo",
    description: "Clear your current cargo selection.",
    cost: "Free",
    costType: "free",
  },
  manilaConfirmPositionsBtn: {
    name: "Confirm Positions",
    description: "Set the three ships' starting positions (must sum to 9).",
    cost: "Free",
    costType: "free",
  },
  manilaPassBtn: {
    name: "Pass Placement",
    description: "Pass your placement turn without placing a worker.",
    cost: "Free",
    costType: "free",
  },
  manilaNextRoundBtn: {
    name: "Next Round",
    description: "Mark yourself ready. The next round starts when everyone is ready.",
    cost: "Free",
    costType: "free",
  },
  manilaPirateBoardBtn: {
    name: "Board",
    description: "Send your pirate to board a ship (take a seat).",
    cost: "Free",
    costType: "free",
  },
  manilaPiratePlunderBtn: {
    name: "Plunder",
    description: "As Captain, plunder a ship that hit port exactly.",
    cost: "Gain ship value",
    costType: "gain",
  },
  manilaPirateSkipBtn: {
    name: "Skip",
    description: "Skip your pirate action.",
    cost: "Free",
    costType: "free",
  },
  manilaPledgeBtn: {
    name: "Pledge Stock",
    description: "Pledge one stock for immediate cash. You repay more at final scoring.",
    cost: "Gain loan",
    costType: "gain",
  },
};

let manilaExplainMode = false;

function formatManilaPlayerName(view, playerId) {
  if (!view || !Array.isArray(view.players)) {
    return playerId || "-";
  }
  const match = view.players.find((p) => p.player_id === playerId);
  if (!match) {
    return playerId || "-";
  }
  return match.name || match.player_id || "-";
}

function formatManilaSeat(seat, view) {
  if (!seat) {
    return "-";
  }
  return formatManilaPlayerName(view, seat);
}

function formatManilaBidLine(view) {
  if (!view || !view.auction || !view.auction.bids || !Array.isArray(view.players)) {
    return "";
  }
  const parts = view.players.map((player) => {
    const amount = view.auction.bids[player.player_id] ?? 0;
    const name = player.name || player.player_id;
    return `${name} ${amount}`;
  });
  return parts.length ? `Bids: ${parts.join(" · ")}` : "";
}

function renderManilaBidList(view) {
  if (!view || !view.auction || !view.auction.bids || !Array.isArray(view.players)) {
    return "";
  }
  const active = new Set(view.auction.active || []);
  const rows = view.players.map((player) => {
    const amount = view.auction.bids[player.player_id] ?? 0;
    const name = player.name || player.player_id;
    const isLeader = view.auction.leader === player.player_id;
    const isPassed = !active.has(player.player_id);
    return `
      <div class="manila-auction-bid-row ${isLeader ? "leader" : ""} ${isPassed ? "passed" : ""}">
        <span>${name}${isPassed ? " (Passed)" : ""}</span>
        <span>${isPassed ? "—" : `🪙 ${amount}`}</span>
      </div>
    `;
  });
  return rows.join("");
}

function getCargoList(view) {
  if (!view) {
    return MANILA_CARGO_ORDER.slice();
  }
  const cargos = new Set();
  if (view.price_track) {
    Object.keys(view.price_track).forEach((key) => cargos.add(key));
  }
  if (Array.isArray(view.cargo_slots)) {
    view.cargo_slots.forEach((key) => cargos.add(key));
  }
  Object.keys(view.boats || {}).forEach((key) => cargos.add(key));
  return cargos.size ? Array.from(cargos) : MANILA_CARGO_ORDER.slice();
}

function getCargoOrder(view) {
  const base = MANILA_CARGO_ORDER.slice();
  const extra = getCargoList(view).filter((cargo) => !base.includes(cargo));
  return base.concat(extra);
}

function getCargoMeta(cargo) {
  return MANILA_CARGO_META[cargo] || { label: cargo, icon: "⬜", accent: "neutral" };
}

function renderManilaCargoChip(cargo) {
  const meta = getCargoMeta(cargo);
  const label = meta.label || cargo;
  const accent = meta.accent || "neutral";
  return `<span class="manila-cargo-chip manila-cargo-${accent}">${meta.icon} ${label}</span>`;
}

function showManilaTooltip(message) {
  if (!manilaTooltip) {
    return;
  }
  manilaTooltip.textContent = message;
  setVisible(manilaTooltip, true);
  if (manilaTooltipTimer) {
    clearTimeout(manilaTooltipTimer);
  }
  manilaTooltipTimer = window.setTimeout(() => {
    setVisible(manilaTooltip, false);
    manilaTooltipTimer = null;
  }, 3000);
}

function isActionAvailable(view, actionType) {
  if (!view || !Array.isArray(view.legal_actions)) {
    return false;
  }
  return view.legal_actions.includes(actionType);
}

function canPlaceWorker(view) {
  if (!view) {
    return false;
  }
  return view.phase === "placement" && view.current_player === view.you && isActionAvailable(view, "place_worker");
}

function setVisible(el, visible) {
  if (!el) {
    return;
  }
  el.classList.toggle("hidden", !visible);
  el.setAttribute("aria-hidden", (!visible).toString());
}

function setDisabled(el, disabled) {
  if (!el) {
    return;
  }
  el.disabled = !!disabled;
  el.classList.toggle("disabled", !!disabled);
}

function formatManilaPhase(phase) {
  if (!phase) {
    return "-";
  }
  return phase.replace(/_/g, " ");
}

function setManilaCycleOpen(open) {
  manilaCycleOpen = open;
  if (typeof setModalVisible === "function") {
    setModalVisible(manilaCycleModal, open);
  } else {
    setVisible(manilaCycleModal, open);
  }
  if (manilaCycleToggleBtn) {
    manilaCycleToggleBtn.textContent = open ? "Hide Harbormaster Panel" : "Open Harbormaster Panel";
  }
}

function updateManilaCycleRecap(view) {
  if (!manilaCycleRecap) {
    return;
  }
  if (!view) {
    manilaCycleRecap.textContent = "No cycle data yet.";
    return;
  }
  const phaseLabel = formatManilaPhase(view.phase);
  const harbor = formatManilaPlayerName(view, view.harbormaster);
  const bid = view.harbormaster_bid ?? 0;
  const cargoSlots = Array.isArray(view.cargo_slots) ? view.cargo_slots : [];
  const cargoLabel = cargoSlots.length ? cargoSlots.map((cargo) => renderManilaCargoChip(cargo)).join(" ") : "-";
  const you = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  const cash = you ? Number(you.cash || 0) : 0;
  const stockCount = you && you.stocks ? Object.values(you.stocks).reduce((sum, val) => sum + (val || 0), 0) : 0;
  const selfLine = you ? `You: 🪙 ${cash} · Pledge ${stockCount}` : "";
  manilaCycleRecap.innerHTML = `
    <div>Phase: <span>${phaseLabel}</span></div>
    <div>Harbormaster: <span>${harbor}</span></div>
    <div>Bid: <span>🪙 ${bid}</span></div>
    ${selfLine ? `<div class="manila-auction-self">${selfLine}</div>` : ""}
    <div>Cargo Slots: <span>${cargoLabel}</span></div>
  `;
}

function updateManilaCyclePanel(view) {
  if (!view) {
    setManilaCycleOpen(false);
    if (manilaCycleStatus) {
      manilaCycleStatus.textContent = "Cycle: -";
    }
    if (manilaCyclePhase) {
      manilaCyclePhase.textContent = "Phase: -";
    }
    return;
  }
  const phase = view.phase;
  const inCycle = MANILA_CYCLE_PHASES.has(phase);
  const wasInCycle = MANILA_CYCLE_PHASES.has(manilaLastPhase);

  if (inCycle && !wasInCycle) {
    manilaCycleUserOverride = null;
  }
  if (!inCycle && wasInCycle) {
    manilaCycleUserOverride = null;
  }

  if (inCycle) {
    if (manilaCycleUserOverride === "closed") {
      setManilaCycleOpen(false);
    } else {
      setManilaCycleOpen(true);
    }
  } else {
    if (manilaCycleUserOverride === "open") {
      setManilaCycleOpen(true);
    } else {
      setManilaCycleOpen(false);
    }
  }

  const phaseLabel = formatManilaPhase(phase);
  if (manilaCycleStatus) {
    manilaCycleStatus.textContent = inCycle ? `Cycle: ${phaseLabel}` : "Cycle: Review only";
  }
  if (manilaCyclePhase) {
    manilaCyclePhase.textContent = `Phase: ${phaseLabel}`;
  }
  updateManilaCycleRecap(view);
  manilaLastPhase = phase;
}

function showManilaHeaderActions(show) {
  if (manilaHeaderActions) {
    manilaHeaderActions.style.display = show ? "flex" : "none";
  }
}

function showManilaHelpModal() {
  if (!manilaHelpModal) {
    return;
  }
  const content = manilaHelpModal.querySelector(".manila-help-content");
  if (content) {
    content.innerHTML = MANILA_HELP_TEXT;
  }
  if (typeof setModalVisible === "function") {
    setModalVisible(manilaHelpModal, true);
  } else {
    setVisible(manilaHelpModal, true);
  }
}

function closeManilaHelpModal() {
  if (!manilaHelpModal) {
    return;
  }
  if (typeof setModalVisible === "function") {
    setModalVisible(manilaHelpModal, false);
  } else {
    setVisible(manilaHelpModal, false);
  }
}

function updateManilaExplainClasses(enabled) {
  Object.keys(MANILA_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll("[data-manila-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
}

function findManilaExplainTargetAtPoint(x, y) {
  for (const buttonId of Object.keys(MANILA_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { type: "button", key: buttonId };
    }
  }
  const nodes = document.querySelectorAll("[data-manila-explain]");
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { type: "dynamic", key: node.dataset.manilaExplain };
    }
  }
  return null;
}

function toggleManilaExplainMode() {
  manilaExplainMode = !manilaExplainMode;
  document.body.classList.toggle("manila-explain-mode", manilaExplainMode);
  updateManilaExplainClasses(manilaExplainMode);
  if (manilaExplainBtn) {
    manilaExplainBtn.classList.toggle("active", manilaExplainMode);
  }
  if (manilaCycleExplainBtn) {
    manilaCycleExplainBtn.classList.toggle("active", manilaExplainMode);
  }
}

function exitManilaExplainMode() {
  if (!manilaExplainMode) {
    return;
  }
  manilaExplainMode = false;
  document.body.classList.remove("manila-explain-mode");
  updateManilaExplainClasses(false);
  if (manilaExplainBtn) {
    manilaExplainBtn.classList.remove("active");
  }
  if (manilaCycleExplainBtn) {
    manilaCycleExplainBtn.classList.remove("active");
  }
}

function showManilaButtonExplanation(target) {
  let explanation = null;
  if (target.type === "button") {
    explanation = MANILA_BUTTON_EXPLANATIONS[target.key];
  } else if (target.type === "dynamic") {
    explanation = MANILA_DYNAMIC_EXPLANATIONS[target.key];
  }
  if (!explanation || !manilaExplainContent || !manilaExplainModal) {
    return;
  }
  let costClass = "free";
  if (explanation.costType === "pay") costClass = "pay";
  else if (explanation.costType === "gain") costClass = "gain";
  else if (explanation.costType === "end") costClass = "end";

  manilaExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    <span class="explain-cost ${costClass}">${explanation.cost}</span>
  `;
  if (typeof setModalVisible === "function") {
    setModalVisible(manilaExplainModal, true);
  } else {
    setVisible(manilaExplainModal, true);
  }
}

function closeManilaExplainModal() {
  if (!manilaExplainModal) {
    return;
  }
  if (typeof setModalVisible === "function") {
    setModalVisible(manilaExplainModal, false);
  } else {
    setVisible(manilaExplainModal, false);
  }
}

function createSlotButton({ label, meta, occupant, onClick, disabled, explainId }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "manila-slot";
  if (explainId) {
    btn.dataset.manilaExplain = explainId;
  }
  if (occupant) {
    btn.classList.add("occupied");
  }
  btn.innerHTML = `
    <div class=\"manila-slot-label\">${label}</div>
    ${meta ? `<div class=\"manila-slot-meta\">${meta}</div>` : ""}
    <div class=\"manila-slot-occupant\">${occupant || "Empty"}</div>
  `;
  btn.addEventListener("click", () => {
    if (disabled) {
      return;
    }
    onClick();
  });
  setDisabled(btn, disabled);
  return btn;
}

function renderManilaBoats(view) {
  if (!manilaBoats) {
    return;
  }
  manilaBoats.innerHTML = "";
  if (!view) {
    return;
  }
  const selected = Array.isArray(view.cargo_slots) ? view.cargo_slots : [];
  const cargoIds = selected.length ? selected : [];
  if (!cargoIds.length) {
    const empty = document.createElement("div");
    empty.className = "manila-empty";
    empty.textContent = "Harbormaster has not selected cargo yet.";
    manilaBoats.appendChild(empty);
    if (manilaDiceBar) {
      setVisible(manilaDiceBar, false);
      manilaDiceBar.innerHTML = "";
    }
    return;
  }
  const canPlace = canPlaceWorker(view);

  const axis = document.createElement("div");
  axis.className = "manila-axis-vertical";
  const axisHeader = document.createElement("div");
  axisHeader.className = "manila-axis-header";
  const axisTitle = document.createElement("div");
  axisTitle.className = "manila-axis-title";
  axisTitle.textContent = "Shared Route Axis";
  axisHeader.appendChild(axisTitle);

  const positionMap = {};
  const portArrivals = view.port_arrivals || {};
  const arrivalSlots = ["A", "B", "C"];
  const arrivedCargo = new Set(
    arrivalSlots.map((slot) => portArrivals[slot]).filter((cargoId) => !!cargoId),
  );
  const pending = [];
  cargoIds.forEach((cargoId) => {
    const boat = view.boats ? view.boats[cargoId] : null;
    if (!boat || typeof boat.position !== "number") {
      pending.push(cargoId);
      return;
    }
    if (arrivedCargo.has(cargoId) || boat.arrived || boat.plundered) {
      return;
    }
    const pos = boat.position;
    if (!positionMap[pos]) {
      positionMap[pos] = [];
    }
    positionMap[pos].push(cargoId);
  });

  if (manilaDiceBar) {
    const diceEmoji = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    const rolls = cargoIds.map((cargoId) => {
      const boat = view.boats ? view.boats[cargoId] : null;
      return {
        cargoId,
        roll: boat && typeof boat.last_roll === "number" ? boat.last_roll : null,
      };
    });
    const hasRoll = rolls.some((entry) => entry.roll !== null);
    if (!hasRoll) {
      setVisible(manilaDiceBar, false);
      manilaDiceBar.innerHTML = "";
    } else {
      setVisible(manilaDiceBar, true);
      manilaDiceBar.innerHTML = "";
      const title = document.createElement("div");
      title.className = "manila-dice-title";
      title.textContent = "Last Dice Roll";
      const row = document.createElement("div");
      row.className = "manila-dice-row";
      rolls.forEach((entry) => {
        const meta = getCargoMeta(entry.cargoId);
        const chip = document.createElement("div");
        chip.className = "manila-dice-chip";
        const label = document.createElement("span");
        label.textContent = `${meta.icon} ${meta.label || entry.cargoId}`;
        const value = document.createElement("span");
        value.className = "manila-dice-value";
        value.textContent = entry.roll ? `${diceEmoji[entry.roll]} ${entry.roll}` : "—";
        chip.appendChild(label);
        chip.appendChild(value);
        row.appendChild(chip);
      });
      manilaDiceBar.appendChild(title);
      manilaDiceBar.appendChild(row);
    }
    axisHeader.appendChild(manilaDiceBar);
  }

  axis.appendChild(axisHeader);

  if (pending.length) {
    const row = document.createElement("div");
    row.className = "manila-axis-row pending";
    const tick = document.createElement("div");
    tick.className = "manila-axis-tick-label";
    tick.textContent = "Pending";
    row.appendChild(tick);
    const markers = document.createElement("div");
    markers.className = "manila-axis-markers";
    pending.forEach((cargoId) => {
      const boat = view.boats ? view.boats[cargoId] : null;
      markers.appendChild(buildManilaAxisBoat(cargoId, boat, view, canPlace));
    });
    row.appendChild(markers);
    axis.appendChild(row);
  }

  const arrivedRow = document.createElement("div");
  arrivedRow.className = "manila-axis-row arrived";
  const arrivedTick = document.createElement("div");
  arrivedTick.className = "manila-axis-tick-label";
  arrivedTick.textContent = "Arrived";
  arrivedRow.appendChild(arrivedTick);
  const arrivedMarkers = document.createElement("div");
  arrivedMarkers.className = "manila-axis-arrived";
  arrivalSlots.forEach((slot) => {
    const slotWrap = document.createElement("div");
    slotWrap.className = "manila-axis-arrived-slot";
    const slotLabel = document.createElement("div");
    slotLabel.className = "manila-axis-arrived-label";
    slotLabel.textContent = `Port ${slot}`;
    slotWrap.appendChild(slotLabel);
    const cargoId = portArrivals[slot];
    if (cargoId) {
      const boat = view.boats ? view.boats[cargoId] : null;
      slotWrap.appendChild(buildManilaAxisBoat(cargoId, boat, view, canPlace));
    } else {
      const empty = document.createElement("div");
      empty.className = "manila-axis-arrived-empty";
      empty.textContent = "Empty";
      slotWrap.appendChild(empty);
    }
    arrivedMarkers.appendChild(slotWrap);
  });
  arrivedRow.appendChild(arrivedMarkers);
  axis.appendChild(arrivedRow);

  for (let i = 13; i >= 0; i -= 1) {
    const row = document.createElement("div");
    row.className = "manila-axis-row";
    if (i === 13) {
      row.classList.add("port");
    }
    const tick = document.createElement("div");
    tick.className = "manila-axis-tick-label";
    tick.textContent = String(i);
    row.appendChild(tick);
    const markers = document.createElement("div");
    markers.className = "manila-axis-markers";
    const cargosHere = positionMap[i] || [];
    cargosHere.forEach((cargoId) => {
      const boat = view.boats ? view.boats[cargoId] : null;
      markers.appendChild(buildManilaAxisBoat(cargoId, boat, view, canPlace));
    });
    row.appendChild(markers);
    axis.appendChild(row);
  }

  manilaBoats.appendChild(axis);
}

function buildManilaAxisBoat(cargoId, boat, view, canPlace) {
  const meta = getCargoMeta(cargoId);
  const wrapper = document.createElement("div");
  wrapper.className = `manila-axis-boat manila-cargo-${meta.accent}`;
  if (!boat) {
    wrapper.classList.add("inactive");
  }

  const header = document.createElement("div");
  header.className = "manila-axis-boat-header";
  const title = document.createElement("div");
  title.className = "manila-axis-boat-title";
  title.textContent = `${meta.icon} ${meta.label || cargoId}`;
  const value = document.createElement("div");
  value.className = "manila-axis-boat-value";
  const totalValue = boat && typeof boat.total_value === "number" ? boat.total_value : meta.totalValue ?? 0;
  value.textContent = `💰 ${totalValue}`;
  header.appendChild(title);
  header.appendChild(value);
  wrapper.appendChild(header);

  const seatWrap = document.createElement("div");
  seatWrap.className = "manila-axis-seat-grid";
  const seats = boat && Array.isArray(boat.seats) ? boat.seats : [];
  const costs =
    boat && Array.isArray(boat.seat_costs)
      ? boat.seat_costs
      : Array.isArray(meta.seatCosts)
        ? meta.seatCosts
        : [];
  costs.forEach((cost, idx) => {
    const seatBtn = document.createElement("button");
    seatBtn.type = "button";
    seatBtn.className = "manila-seat";
    const occupant = seats[idx];
    const occupantLabel = boat ? (occupant ? formatManilaSeat(occupant, view) : "Empty") : "Not sailing";
    seatBtn.innerHTML = `
      <span class=\"manila-seat-title\">Seat ${idx + 1}</span>
      <span class=\"manila-seat-meta\">🪙 ${cost}</span>
      <span class=\"manila-seat-occupant\">${occupantLabel}</span>
    `;
    seatBtn.addEventListener("click", () => {
      if (!boat) {
        return;
      }
      sendAction({ type: "place_worker", location: { type: "ship", cargo: cargoId, seat: idx } });
    });
    if (!boat) {
      seatBtn.classList.add("inactive");
    }
    setDisabled(seatBtn, !canPlace || !boat || !!occupant);
    seatWrap.appendChild(seatBtn);
  });
  wrapper.appendChild(seatWrap);

  return wrapper;
}

function renderManilaBoard(view) {
  if (!manilaBoard) {
    return;
  }
  manilaBoard.innerHTML = "";
  if (!view || !view.board) {
    return;
  }
  const board = view.board;
  const canPlace = canPlaceWorker(view);

  const map = document.createElement("div");
  map.className = "manila-map-grid";

  const portZone = document.createElement("div");
  portZone.className = "manila-zone manila-zone-port";
  portZone.innerHTML = "<div class=\"manila-zone-title\">Port</div>";
  const portGrid = document.createElement("div");
  portGrid.className = "manila-zone-grid";
  ["A", "B", "C"].forEach((slot) => {
    const info = MANILA_BOARD_VALUES.port[slot];
    const occupantId = board.port ? board.port[slot] : null;
    const btn = createSlotButton({
      label: slot,
      meta: `🪙 ${info.cost} · 💰 ${info.payout}`,
      occupant: occupantId ? formatManilaSeat(occupantId, view) : "",
      disabled: !canPlace || !!occupantId,
      onClick: () => sendAction({ type: "place_worker", location: { type: "port", slot } }),
      explainId: "port",
    });
    portGrid.appendChild(btn);
  });
  portZone.appendChild(portGrid);

  const shipyardZone = document.createElement("div");
  shipyardZone.className = "manila-zone manila-zone-shipyard";
  shipyardZone.innerHTML = "<div class=\"manila-zone-title\">Shipyard</div>";
  const shipyardGrid = document.createElement("div");
  shipyardGrid.className = "manila-zone-grid";
  ["A", "B", "C"].forEach((slot) => {
    const info = MANILA_BOARD_VALUES.shipyard[slot];
    const occupantId = board.shipyard ? board.shipyard[slot] : null;
    const btn = createSlotButton({
      label: slot,
      meta: `🪙 ${info.cost} · 💰 ${info.payout}`,
      occupant: occupantId ? formatManilaSeat(occupantId, view) : "",
      disabled: !canPlace || !!occupantId,
      onClick: () => sendAction({ type: "place_worker", location: { type: "shipyard", slot } }),
      explainId: "shipyard",
    });
    shipyardGrid.appendChild(btn);
  });
  shipyardZone.appendChild(shipyardGrid);

  const rolesZone = document.createElement("div");
  rolesZone.className = "manila-zone manila-zone-roles";
  rolesZone.innerHTML = "<div class=\"manila-zone-title\">Harbor Roles</div>";
  const rolesGrid = document.createElement("div");
  rolesGrid.className = "manila-zone-grid";
  const pirates = board.pirates || {};
  const pirateOccupants = [
    `Captain: ${pirates.captain ? formatManilaSeat(pirates.captain, view) : "-"}`,
    `Pirate: ${pirates.pirate ? formatManilaSeat(pirates.pirate, view) : "-"}`,
  ].join(" · ");
  rolesGrid.appendChild(
    createSlotButton({
      label: "Pirates",
      meta: `🪙 ${MANILA_BOARD_VALUES.pirates.cost} · First = Captain`,
      occupant: pirateOccupants,
      disabled: !canPlace || (!!pirates.captain && !!pirates.pirate),
      onClick: () => sendAction({ type: "place_worker", location: { type: "pirate" } }),
      explainId: "pirate",
    })
  );
  const pilots = board.pilots || {};
  rolesGrid.appendChild(
    createSlotButton({
      label: "Pilot (Big)",
      meta: `🪙 ${MANILA_BOARD_VALUES.pilots.big}`,
      occupant: pilots.big ? formatManilaSeat(pilots.big, view) : "",
      disabled: !canPlace || !!pilots.big,
      onClick: () => sendAction({ type: "place_worker", location: { type: "pilot", size: "big" } }),
      explainId: "pilot",
    })
  );
  rolesGrid.appendChild(
    createSlotButton({
      label: "Pilot (Small)",
      meta: `🪙 ${MANILA_BOARD_VALUES.pilots.small}`,
      occupant: pilots.small ? formatManilaSeat(pilots.small, view) : "",
      disabled: !canPlace || !!pilots.small,
      onClick: () => sendAction({ type: "place_worker", location: { type: "pilot", size: "small" } }),
      explainId: "pilot",
    })
  );
  rolesZone.appendChild(rolesGrid);

  const insuranceZone = document.createElement("div");
  insuranceZone.className = "manila-zone manila-zone-insurance manila-zone-compact";
  insuranceZone.innerHTML = "<div class=\"manila-zone-title\">Insurance</div>";
  const insuranceGrid = document.createElement("div");
  insuranceGrid.className = "manila-zone-grid";
  insuranceGrid.appendChild(
    createSlotButton({
      label: "Broker",
      meta: `🪙 ${MANILA_BOARD_VALUES.insurance.cost} · 💰 +${MANILA_BOARD_VALUES.insurance.reward}`,
      occupant: board.insurance ? formatManilaSeat(board.insurance, view) : "",
      disabled: !canPlace || !!board.insurance,
      onClick: () => sendAction({ type: "place_worker", location: { type: "insurance" } }),
      explainId: "insurance",
    })
  );
  insuranceZone.appendChild(insuranceGrid);

  const insuranceStack = document.createElement("div");
  insuranceStack.className = "manila-zone-stack";
  if (manilaPledgeGroup) {
    insuranceStack.appendChild(manilaPledgeGroup);
  }
  if (manilaPirateGroup) {
    manilaPirateGroup.classList.add("manila-pirate-facility", "manila-zone", "manila-zone-compact");
    insuranceStack.appendChild(manilaPirateGroup);
  }
  insuranceStack.appendChild(insuranceZone);
  if (manilaPassFacility) {
    insuranceStack.appendChild(manilaPassFacility);
  }

  map.appendChild(portZone);
  map.appendChild(shipyardZone);
  map.appendChild(rolesZone);
  map.appendChild(insuranceStack);
  manilaBoard.appendChild(map);
}

function renderManilaPlayers(view) {
  if (!manilaPlayers) {
    return;
  }
  manilaPlayers.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    return;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "manila-card";

    const tags = [];
    if (player.player_id === view.you) {
      tags.push("you");
    }
    if (player.is_bot) {
      tags.push("bot");
    }

    const title = document.createElement("div");
    title.className = "manila-card-title";
    title.textContent = `${player.name || player.player_id} (${tags.join(", ") || "player"})`;
    card.appendChild(title);

    const line1 = document.createElement("div");
    line1.className = "manila-card-line";
    line1.textContent = `🪙 ${player.cash ?? 0} · 👥 ${player.workers_available ?? 0}/${player.workers_total ?? 0}`;
    card.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "manila-card-line";
    if (player.stocks) {
      const stockParts = Object.entries(player.stocks).map(([cargo, count]) => {
        const meta = getCargoMeta(cargo);
        return `${meta.icon}${count}`;
      });
      const pledgeParts = Object.entries(player.pledged || {}).map(([cargo, count]) => {
        const meta = getCargoMeta(cargo);
        return `${meta.icon}${count}`;
      });
      line2.textContent = `Stocks: ${stockParts.join(" ") || "-"} · Pledged: ${pledgeParts.join(" ") || "-"}`;
    } else {
      line2.textContent = `Stocks: ${player.stock_count ?? 0} · Pledged: ${player.pledged_count ?? 0}`;
    }
    card.appendChild(line2);

    manilaPlayers.appendChild(card);
  });
}

function updateAuctionActions(view) {
  const visible = view && view.phase === "auction";
  setVisible(document.getElementById("manilaAuctionGroup"), visible);
  if (!visible) {
    return;
  }
  const isMyTurn = view.current_player === view.you;
  const you = Array.isArray(view.players) ? view.players.find((p) => p.player_id === view.you) : null;
  const cash = you ? Number(you.cash || 0) : 0;
  const stockCount = you && you.stocks ? Object.values(you.stocks).reduce((sum, val) => sum + (val || 0), 0) : 0;
  if (manilaBidInput) {
    const currentBid = view.auction ? view.auction.highest_bid || 0 : 0;
    manilaBidInput.min = String(currentBid + 1);
    if (!manilaBidInput.value) {
      manilaBidInput.value = String(currentBid + 1);
    }
  }
  setDisabled(manilaBidBtn, !isMyTurn);
  setDisabled(manilaPassBidBtn, !isMyTurn);
  if (manilaAuctionInfo && view.auction) {
    const leader = view.auction.leader ? formatManilaPlayerName(view, view.auction.leader) : "-";
    const highest = view.auction.highest_bid ?? 0;
    const bidsLine = formatManilaBidLine(view);
    manilaAuctionInfo.innerHTML = `
      <div>Highest bid ${highest} · Leader ${leader}</div>
      ${bidsLine ? `<div class="manila-auction-bids">${bidsLine}</div>` : ""}
    `;
  }
  if (manilaAuctionBidList) {
    manilaAuctionBidList.innerHTML = renderManilaBidList(view);
  }
}

function updatePayBidActions(view) {
  return;
}

function updatePledgeActions(view) {
  setVisible(manilaPledgeGroup, !!view);
  if (!manilaPledgeSelect || !manilaPledgeBtn) {
    return;
  }
  const cargos = getCargoList(view);
  manilaPledgeSelect.innerHTML = "";
  cargos.forEach((cargo) => {
    const opt = document.createElement("option");
    opt.value = cargo;
    opt.textContent = cargo;
    manilaPledgeSelect.appendChild(opt);
  });
  const legal = view.legal_actions || [];
  setDisabled(manilaPledgeBtn, !legal.includes("pledge_stock"));
}

function updateBuyStockActions(view) {
  const visible = view && view.phase === "harbormaster_buy";
  setVisible(manilaBuyStockGroup, visible);
  if (!visible || !manilaBuyStockButtons) {
    return;
  }
  const isMyTurn = view.current_player === view.you;
  const cargos = getCargoList(view);
  manilaBuyStockButtons.innerHTML = "";
  cargos.forEach((cargo) => {
    const price = view.price_track && view.price_track[cargo] ? view.price_track[cargo] : 0;
    const cost = price > 0 ? price : 5;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("manila-buy-stock-btn");
    btn.innerHTML = `Buy ${renderManilaCargoChip(cargo)} <span class="manila-buy-cost">🪙 ${cost}</span>`;
    btn.addEventListener("click", () => sendAction({ type: "buy_stock", cargo }));
    setDisabled(btn, !isMyTurn);
    manilaBuyStockButtons.appendChild(btn);
  });
  setDisabled(manilaSkipBuyBtn, !isMyTurn);
}

function updateSelectCargoActions(view) {
  const visible = view && view.phase === "harbormaster_cargo";
  setVisible(manilaSelectCargoGroup, visible);
  if (!visible || !manilaSelectCargoButtons) {
    return;
  }
  const cargos = getCargoList(view);
  if (!manilaSelectedCargo.length || manilaSelectedCargo.some((c) => !cargos.includes(c))) {
    manilaSelectedCargo = [];
  }
  manilaSelectCargoButtons.innerHTML = "";
  cargos.forEach((cargo) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isSelected = manilaSelectedCargo.includes(cargo);
    btn.className = isSelected ? "selected" : "";
    btn.classList.add("manila-cargo-select-btn");
    btn.innerHTML = renderManilaCargoChip(cargo);
    btn.addEventListener("click", () => {
      if (manilaSelectedCargo.includes(cargo)) {
        manilaSelectedCargo = manilaSelectedCargo.filter((c) => c !== cargo);
      } else if (manilaSelectedCargo.length < 3) {
        manilaSelectedCargo = [...manilaSelectedCargo, cargo];
      }
      updateSelectCargoActions(view);
    });
    manilaSelectCargoButtons.appendChild(btn);
  });
  setDisabled(manilaConfirmCargoBtn, manilaSelectedCargo.length !== 3 || view.current_player !== view.you);
  setDisabled(manilaResetCargoBtn, view.current_player !== view.you);
}

function updatePositionsActions(view) {
  const visible = view && view.phase === "harbormaster_position";
  setVisible(manilaPositionsGroup, visible);
  if (!visible || !manilaPositionsWrap) {
    return;
  }
  manilaPositionsWrap.innerHTML = "";
  const cargos = Array.isArray(view.cargo_slots) ? view.cargo_slots : [];
  cargos.forEach((cargo, idx) => {
    const row = document.createElement("div");
    row.className = "manila-position-row";
    const label = document.createElement("div");
    label.innerHTML = renderManilaCargoChip(cargo);
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "13";
    input.value = idx === 0 ? 0 : idx === 1 ? 4 : 5;
    input.addEventListener("input", () => {
      const sum = updatePositionsSum();
      const isMyTurn = view.current_player === view.you;
      setDisabled(manilaConfirmPositionsBtn, !isMyTurn || sum !== 9);
    });
    row.appendChild(label);
    row.appendChild(input);
    manilaPositionsWrap.appendChild(row);
  });
  const sum = updatePositionsSum();
  const isMyTurn = view.current_player === view.you;
  setDisabled(manilaConfirmPositionsBtn, !isMyTurn || sum !== 9);
}

function updatePositionsSum() {
  if (!manilaPositionsWrap || !manilaPositionsSum) {
    return 0;
  }
  const inputs = Array.from(manilaPositionsWrap.querySelectorAll("input"));
  const values = inputs.map((input) => Number.parseInt(input.value, 10) || 0);
  const sum = values.reduce((acc, val) => acc + val, 0);
  manilaPositionsSum.textContent = String(sum);
  return sum;
}

function updatePlacementActions(view) {
  const visible = view && view.phase === "placement";
  setVisible(manilaPassFacility, visible);
  if (!visible) {
    return;
  }
  const isMyTurn = view.current_player === view.you;
  setDisabled(manilaPassBtn, !isMyTurn);
}

function updatePilotActions(view) {
  const visible = view && view.phase === "pilot";
  setVisible(manilaPilotGroup, visible);
  if (!visible || !manilaPilotRows) {
    return;
  }
  manilaPilotRows.innerHTML = "";
  const pending = Array.isArray(view.pending_pilots) ? view.pending_pilots : [];
  const cargos = getCargoList(view);
  const isMyTurn = view.current_player === view.you;

  if (!pending.length) {
    const empty = document.createElement("div");
    empty.className = "manila-empty";
    empty.textContent = "No pilots to move.";
    manilaPilotRows.appendChild(empty);
    return;
  }

  pending.forEach((size) => {
    const row = document.createElement("div");
    row.className = "manila-action-row";
    const label = document.createElement("div");
    label.className = "manila-action-label";
    label.textContent = size === "big" ? "Big Pilot" : "Small Pilot";
    const cargoSelect = document.createElement("select");
    cargos.forEach((cargo) => {
      const opt = document.createElement("option");
      opt.value = cargo;
      opt.textContent = cargo;
      cargoSelect.appendChild(opt);
    });
    const deltaSelect = document.createElement("select");
    const deltas = size === "big" ? [-2, -1, 1, 2] : [-1, 1];
    deltas.forEach((delta) => {
      const opt = document.createElement("option");
      opt.value = String(delta);
      opt.textContent = delta > 0 ? `+${delta}` : `${delta}`;
      deltaSelect.appendChild(opt);
    });
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Move";
    btn.addEventListener("click", () =>
      sendAction({
        type: "pilot_move",
        size,
        cargo: cargoSelect.value,
        delta: Number.parseInt(deltaSelect.value, 10),
      })
    );
    setDisabled(btn, !isMyTurn);
    row.appendChild(label);
    row.appendChild(cargoSelect);
    row.appendChild(deltaSelect);
    row.appendChild(btn);
    manilaPilotRows.appendChild(row);

    if (size === "big") {
      const splitRow = document.createElement("div");
      splitRow.className = "manila-action-row";
      const splitLabel = document.createElement("div");
      splitLabel.className = "manila-action-label";
      splitLabel.textContent = "Split (+/-1)";
      const cargoA = document.createElement("select");
      const cargoB = document.createElement("select");
      cargos.forEach((cargo) => {
        const optA = document.createElement("option");
        optA.value = cargo;
        optA.textContent = cargo;
        cargoA.appendChild(optA);
        const optB = document.createElement("option");
        optB.value = cargo;
        optB.textContent = cargo;
        cargoB.appendChild(optB);
      });
      const deltaA = document.createElement("select");
      const deltaB = document.createElement("select");
      [-1, 1].forEach((delta) => {
        const optA = document.createElement("option");
        optA.value = String(delta);
        optA.textContent = delta > 0 ? `+${delta}` : `${delta}`;
        deltaA.appendChild(optA);
        const optB = document.createElement("option");
        optB.value = String(delta);
        optB.textContent = delta > 0 ? `+${delta}` : `${delta}`;
        deltaB.appendChild(optB);
      });
      const splitBtn = document.createElement("button");
      splitBtn.type = "button";
      splitBtn.textContent = "Split Move";
      splitBtn.addEventListener("click", () =>
        sendAction({
          type: "pilot_split",
          size: "big",
          cargo_a: cargoA.value,
          delta_a: Number.parseInt(deltaA.value, 10),
          cargo_b: cargoB.value,
          delta_b: Number.parseInt(deltaB.value, 10),
        })
      );
      setDisabled(splitBtn, !isMyTurn);
      splitRow.appendChild(splitLabel);
      splitRow.appendChild(cargoA);
      splitRow.appendChild(deltaA);
      splitRow.appendChild(cargoB);
      splitRow.appendChild(deltaB);
      splitRow.appendChild(splitBtn);
      manilaPilotRows.appendChild(splitRow);
    }
  });
}

function updatePirateActions(view) {
  const visible = view && view.phase === "pirate";
  setVisible(manilaPirateGroup, visible);
  if (!visible) {
    return;
  }
  const isMyTurn = view.current_player === view.you;
  const pirates = view.board ? view.board.pirates || {} : {};
  const day = view.pirate_day || 3;
  if (manilaPirateRole) {
    let role = "-";
    if (pirates.captain === view.you) {
      role = "Captain";
    } else if (pirates.pirate === view.you) {
      role = "Pirate";
    }
    manilaPirateRole.textContent = role;
  }
  if (manilaPirateTargetSelect) {
    manilaPirateTargetSelect.innerHTML = "";
    (view.pirate_targets || []).forEach((cargo) => {
      const opt = document.createElement("option");
      opt.value = cargo;
      opt.textContent = cargo;
      manilaPirateTargetSelect.appendChild(opt);
    });
  }
  const hasTargets = (view.pirate_targets || []).length > 0;
  const isCaptain = pirates.captain === view.you;

  if (manilaPirateResultSelect) {
    setVisible(manilaPirateResultSelect, day === 3);
  }

  const showBoard = day === 2;
  const showPlunder = day === 3;
  setVisible(manilaPirateBoardBtn, showBoard);
  setVisible(manilaPiratePlunderBtn, showPlunder);
  setVisible(manilaPirateSkipBtn, day === 2);

  setDisabled(manilaPirateBoardBtn, !isMyTurn || !hasTargets);
  setDisabled(manilaPiratePlunderBtn, !isMyTurn || !isCaptain || !hasTargets);
  setDisabled(manilaPirateSkipBtn, !isMyTurn);
}

function formatManilaLedgerLabel(label) {
  if (!label) {
    return label;
  }
  if (label.startsWith("Ship ")) {
    const cargo = label.slice(5).toLowerCase();
    return `Ship ${renderManilaCargoChip(cargo)}`;
  }
  if (label.startsWith("Seat ")) {
    const match = label.match(/^Seat\s+([A-Za-z]+)\s+#(\d+)/);
    if (match) {
      const cargo = match[1].toLowerCase();
      const seatNo = match[2];
      return `Seat ${renderManilaCargoChip(cargo)} #${seatNo}`;
    }
  }
  if (label.startsWith("Buy ")) {
    const cargo = label.slice(4).toLowerCase();
    return `Buy ${renderManilaCargoChip(cargo)}`;
  }
  return label;
}

function updateRoundEnd(view) {
  const visible = view && view.phase === "round_end";
  setVisible(manilaRoundEndPanel, visible);
  if (!visible) {
    return;
  }
  const players = Array.isArray(view.players) ? view.players : [];
  const readyMap = new Map(players.map((player) => [player.player_id, !!player.round_ready]));
  const ledger = view.round_ledger || {};
  if (manilaRoundEndPlayers) {
    manilaRoundEndPlayers.innerHTML = "";
    players.forEach((player) => {
      const card = document.createElement("div");
      card.className = "manila-round-end-player";
      if (readyMap.get(player.player_id)) {
        card.classList.add("ready");
      }
      const name = document.createElement("div");
      name.className = "manila-round-end-player-name";
      name.textContent = formatManilaPlayerName(view, player.player_id);
      const status = document.createElement("div");
      status.className = "manila-round-end-player-status";
      status.textContent = readyMap.get(player.player_id) ? "Ready" : "Waiting";
      card.appendChild(name);
      card.appendChild(status);

      const entry = ledger[player.player_id] || { earn: {}, spend: {} };
      const earnEntries = entry.earn || {};
      const spendEntries = entry.spend || {};
      const earnTotal = Object.values(earnEntries).reduce((sum, val) => sum + Number(val || 0), 0);
      const spendTotal = Object.values(spendEntries).reduce((sum, val) => sum + Number(val || 0), 0);

      const breakdown = document.createElement("div");
      breakdown.className = "manila-round-end-breakdown";

      const earnBlock = document.createElement("div");
      earnBlock.className = "manila-round-end-block";
      const earnTitle = document.createElement("div");
      earnTitle.className = "manila-round-end-label";
      earnTitle.textContent = `Earned +${earnTotal}`;
      earnBlock.appendChild(earnTitle);
      const earnList = document.createElement("div");
      earnList.className = "manila-round-end-list";
      const earnItems = Object.entries(earnEntries);
      if (!earnItems.length) {
        const empty = document.createElement("div");
        empty.className = "manila-round-end-line muted";
        empty.textContent = "None";
        earnList.appendChild(empty);
      } else {
        earnItems.forEach(([label, amount]) => {
          const line = document.createElement("div");
          line.className = "manila-round-end-line";
          line.innerHTML = `${formatManilaLedgerLabel(label)}: +${amount}`;
          earnList.appendChild(line);
        });
      }
      earnBlock.appendChild(earnList);

      const spendBlock = document.createElement("div");
      spendBlock.className = "manila-round-end-block";
      const spendTitle = document.createElement("div");
      spendTitle.className = "manila-round-end-label";
      spendTitle.textContent = `Spent -${spendTotal}`;
      spendBlock.appendChild(spendTitle);
      const spendList = document.createElement("div");
      spendList.className = "manila-round-end-list";
      const spendItems = Object.entries(spendEntries);
      if (!spendItems.length) {
        const empty = document.createElement("div");
        empty.className = "manila-round-end-line muted";
        empty.textContent = "None";
        spendList.appendChild(empty);
      } else {
        spendItems.forEach(([label, amount]) => {
          const line = document.createElement("div");
          line.className = "manila-round-end-line";
          line.innerHTML = `${formatManilaLedgerLabel(label)}: -${amount}`;
          spendList.appendChild(line);
        });
      }
      spendBlock.appendChild(spendList);

      breakdown.appendChild(earnBlock);
      breakdown.appendChild(spendBlock);
      card.appendChild(breakdown);
      manilaRoundEndPlayers.appendChild(card);
    });
  }
  const readyCount = players.filter((player) => readyMap.get(player.player_id)).length;
  if (manilaRoundEndStatus) {
    manilaRoundEndStatus.textContent = `${readyCount}/${players.length} Ready`;
  }
  const canReady = Array.isArray(view.legal_actions) && view.legal_actions.includes("next_round");
  const alreadyReady = !!readyMap.get(view.you);
  if (manilaNextRoundBtn) {
    manilaNextRoundBtn.textContent = alreadyReady ? "Waiting..." : "Next Round";
    setDisabled(manilaNextRoundBtn, !canReady || alreadyReady);
  }
}

function updateActions(view) {
  updateAuctionActions(view);
  updatePayBidActions(view);
  updatePledgeActions(view);
  updateBuyStockActions(view);
  updateSelectCargoActions(view);
  updatePositionsActions(view);
  updatePlacementActions(view);
  updatePilotActions(view);
  updatePirateActions(view);
  updateRoundEnd(view);
}

function renderManilaGameState(data) {
  const view = data.view;
  currentManilaView = view;
  if (currentGameType !== "manila") {
    currentGameType = "manila";
    setGamePanelVisibility("manila");
  }
  if (!view) {
    return;
  }
  if (manilaPhaseLabel) {
    manilaPhaseLabel.textContent = view.phase || "-";
  }
  if (manilaRoundLabel) {
    manilaRoundLabel.textContent = view.round ?? "-";
  }
  if (manilaCurrentLabel) {
    manilaCurrentLabel.textContent = formatManilaPlayerName(view, view.current_player);
  }
  if (manilaHarborLabel) {
    manilaHarborLabel.textContent = formatManilaPlayerName(view, view.harbormaster);
  }
  if (manilaHarborBidLabel) {
    manilaHarborBidLabel.textContent = view.harbormaster_bid ?? 0;
  }
  if (manilaPricesLabel) {
    const track = view.price_track || {};
    const parts = Object.entries(track).map(([cargo, value]) => `${cargo}:${value}`);
    manilaPricesLabel.textContent = parts.join(" · ") || "-";
  }
  if (manilaLegalActions) {
    const actions = Array.isArray(view.legal_actions) ? view.legal_actions : [];
    manilaLegalActions.textContent = actions.length ? actions.join(", ") : "-";
  }
  updateManilaCyclePanel(view);
  renderManilaBoats(view);
  renderManilaBoard(view);
  renderManilaPlayers(view);
  updateActions(view);
}

function clearManilaState() {
  currentManilaView = null;
  manilaSelectedCargo = [];
  manilaCycleOpen = false;
  manilaCycleUserOverride = null;
  manilaLastPhase = null;
  if (manilaPhaseLabel) manilaPhaseLabel.textContent = "-";
  if (manilaRoundLabel) manilaRoundLabel.textContent = "-";
  if (manilaCurrentLabel) manilaCurrentLabel.textContent = "-";
  if (manilaHarborLabel) manilaHarborLabel.textContent = "-";
  if (manilaHarborBidLabel) manilaHarborBidLabel.textContent = "-";
  if (manilaPricesLabel) manilaPricesLabel.textContent = "-";
  if (manilaBoats) manilaBoats.innerHTML = "";
  if (manilaDiceBar) {
    manilaDiceBar.innerHTML = "";
    setVisible(manilaDiceBar, false);
  }
  if (manilaBoard) manilaBoard.innerHTML = "";
  if (manilaPlayers) manilaPlayers.innerHTML = "";
  if (manilaLegalActions) manilaLegalActions.textContent = "-";
  if (manilaAuctionInfo) manilaAuctionInfo.textContent = "";
  if (manilaCycleStatus) manilaCycleStatus.textContent = "Cycle: -";
  if (manilaCyclePhase) manilaCyclePhase.textContent = "Phase: -";
  if (manilaCycleRecap) manilaCycleRecap.textContent = "No cycle data yet.";
  setManilaCycleOpen(false);
  exitManilaExplainMode();
  if (manilaPassFacility) setVisible(manilaPassFacility, false);
  if (manilaRoundEndPanel) setVisible(manilaRoundEndPanel, false);
  if (manilaRoundEndPlayers) manilaRoundEndPlayers.innerHTML = "";
  if (manilaRoundEndStatus) manilaRoundEndStatus.textContent = "0/0 Ready";
  if (manilaTooltip) setVisible(manilaTooltip, false);
  if (manilaTooltipTimer) {
    clearTimeout(manilaTooltipTimer);
    manilaTooltipTimer = null;
  }
}

if (manilaBidBtn && manilaBidInput) {
  manilaBidBtn.addEventListener("click", () => {
    const amount = Number.parseInt(manilaBidInput.value, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      log("Enter a valid bid.");
      return;
    }
    sendAction({ type: "bid", amount });
  });
}
if (manilaPassBidBtn) {
  manilaPassBidBtn.addEventListener("click", () => sendAction({ type: "pass_bid" }));
}
if (manilaPledgeBtn && manilaPledgeSelect) {
  manilaPledgeBtn.addEventListener("click", () =>
    sendAction({ type: "pledge_stock", cargo: manilaPledgeSelect.value })
  );
}
if (manilaSkipBuyBtn) {
  manilaSkipBuyBtn.addEventListener("click", () => sendAction({ type: "skip_buy" }));
}
if (manilaConfirmCargoBtn) {
  manilaConfirmCargoBtn.addEventListener("click", () =>
    sendAction({ type: "select_cargo", cargo: manilaSelectedCargo })
  );
}
if (manilaResetCargoBtn) {
  manilaResetCargoBtn.addEventListener("click", () => {
    manilaSelectedCargo = [];
    updateSelectCargoActions(currentManilaView);
  });
}
if (manilaConfirmPositionsBtn) {
  manilaConfirmPositionsBtn.addEventListener("click", () => {
    if (!manilaPositionsWrap) {
      return;
    }
    const inputs = Array.from(manilaPositionsWrap.querySelectorAll("input"));
    const positions = inputs.map((input) => Number.parseInt(input.value, 10) || 0);
    sendAction({ type: "set_positions", positions });
  });
}
if (manilaPassBtn) {
  manilaPassBtn.addEventListener("click", () => sendAction({ type: "pass" }));
}
if (manilaPirateBoardBtn && manilaPirateTargetSelect) {
  manilaPirateBoardBtn.addEventListener("click", () =>
    sendAction({ type: "pirate_action", mode: "board", cargo: manilaPirateTargetSelect.value })
  );
}
if (manilaPiratePlunderBtn && manilaPirateTargetSelect) {
  manilaPiratePlunderBtn.addEventListener("click", () =>
    sendAction({
      type: "pirate_action",
      mode: "plunder",
      cargo: manilaPirateTargetSelect.value,
      result: manilaPirateResultSelect ? manilaPirateResultSelect.value : "port",
    })
  );
}
if (manilaPirateSkipBtn) {
  manilaPirateSkipBtn.addEventListener("click", () => sendAction({ type: "pirate_action", mode: "skip" }));
}
if (manilaNextRoundBtn) {
  manilaNextRoundBtn.addEventListener("click", () => sendAction({ type: "next_round" }));
}

if (manilaCycleToggleBtn) {
  manilaCycleToggleBtn.addEventListener("click", () => {
    const nextOpen = !manilaCycleOpen;
    manilaCycleUserOverride = nextOpen ? "open" : "closed";
    setManilaCycleOpen(nextOpen);
  });
}

if (manilaCycleCloseBtn) {
  manilaCycleCloseBtn.addEventListener("click", () => {
    manilaCycleUserOverride = "closed";
    setManilaCycleOpen(false);
  });
}

if (manilaHelpBtn) {
  manilaHelpBtn.addEventListener("click", showManilaHelpModal);
}

if (manilaHelpModalCloseBtn) {
  manilaHelpModalCloseBtn.addEventListener("click", closeManilaHelpModal);
}

if (manilaExplainBtn) {
  manilaExplainBtn.addEventListener("click", () => {
    toggleManilaExplainMode();
  });
}

if (manilaCycleExplainBtn) {
  manilaCycleExplainBtn.addEventListener("click", () => {
    toggleManilaExplainMode();
  });
}

if (manilaExplainModalCloseBtn) {
  manilaExplainModalCloseBtn.addEventListener("click", closeManilaExplainModal);
}

document.addEventListener("pointerdown", (event) => {
  if (!manilaExplainMode) {
    return;
  }
  const target = findManilaExplainTargetAtPoint(event.clientX, event.clientY);
  if (target) {
    event.preventDefault();
    event.stopPropagation();
    showManilaButtonExplanation(target);
    exitManilaExplainMode();
    return;
  }

  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (button === manilaExplainBtn || button === manilaHelpBtn) return;
  if (button === manilaCycleExplainBtn) return;
  if (button === manilaHelpModalCloseBtn || button === manilaExplainModalCloseBtn) return;
  if (button === manilaCycleCloseBtn) return;

  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("click", (event) => {
  if (!manilaExplainMode) {
    return;
  }
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (button === manilaExplainBtn || button === manilaHelpBtn) return;
  if (button === manilaCycleExplainBtn) return;
  if (button === manilaHelpModalCloseBtn || button === manilaExplainModalCloseBtn) return;
  if (button === manilaCycleCloseBtn) return;

  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (manilaCycleOpen) {
    manilaCycleUserOverride = "closed";
    setManilaCycleOpen(false);
  }
  if (manilaHelpModal && !manilaHelpModal.classList.contains("hidden")) {
    closeManilaHelpModal();
  }
  if (manilaExplainModal && !manilaExplainModal.classList.contains("hidden")) {
    closeManilaExplainModal();
  }
  if (manilaExplainMode) {
    exitManilaExplainMode();
  }
});

if (!manilaErrorListenerBound && typeof socket !== "undefined" && socket) {
  manilaErrorListenerBound = true;
  socket.on("system:error", (data) => {
    if (currentGameType !== "manila") {
      return;
    }
    const message = data && data.message ? String(data.message) : "";
    if (!message) {
      return;
    }
    if (message.includes("insufficient cash") && currentManilaView && currentManilaView.phase === "placement") {
      showManilaTooltip("Not enough cash to place here.");
    }
  });
}

window.renderManilaGameState = renderManilaGameState;
window.clearManilaState = clearManilaState;
window.showManilaHeaderActions = showManilaHeaderActions;
