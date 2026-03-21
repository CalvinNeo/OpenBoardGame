let currentManilaView = null;
let manilaSelectedCargo = [];

const manilaPhaseLabel = document.getElementById("manilaPhase");
const manilaRoundLabel = document.getElementById("manilaRound");
const manilaCurrentLabel = document.getElementById("manilaCurrent");
const manilaHarborLabel = document.getElementById("manilaHarbor");
const manilaHarborBidLabel = document.getElementById("manilaHarborBid");
const manilaPricesLabel = document.getElementById("manilaPrices");
const manilaBoats = document.getElementById("manilaBoats");
const manilaBoard = document.getElementById("manilaBoard");
const manilaPlayers = document.getElementById("manilaPlayers");
const manilaLegalActions = document.getElementById("manilaLegalActions");

const manilaAuctionInfo = document.getElementById("manilaAuctionInfo");
const manilaBidInput = document.getElementById("manilaBidInput");
const manilaBidBtn = document.getElementById("manilaBidBtn");
const manilaPassBidBtn = document.getElementById("manilaPassBidBtn");
const manilaPayBidBtn = document.getElementById("manilaPayBidBtn");
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

const manilaPlacementGroup = document.getElementById("manilaPlacementGroup");
const manilaPassBtn = document.getElementById("manilaPassBtn");

const manilaPilotGroup = document.getElementById("manilaPilotGroup");
const manilaPilotRows = document.getElementById("manilaPilotRows");

const manilaPirateGroup = document.getElementById("manilaPirateGroup");
const manilaPirateRole = document.getElementById("manilaPirateRole");
const manilaPirateTargetSelect = document.getElementById("manilaPirateTargetSelect");
const manilaPirateBoardBtn = document.getElementById("manilaPirateBoardBtn");
const manilaPiratePlunderBtn = document.getElementById("manilaPiratePlunderBtn");
const manilaPirateSkipBtn = document.getElementById("manilaPirateSkipBtn");

const manilaHeaderActions = document.getElementById("manilaHeaderActions");
const manilaHelpBtn = document.getElementById("manilaHelpBtn");
const manilaExplainBtn = document.getElementById("manilaExplainBtn");
const manilaHelpModal = document.getElementById("manilaHelpModal");
const manilaHelpModalCloseBtn = document.getElementById("manilaHelpModalCloseBtn");
const manilaExplainModal = document.getElementById("manilaExplainModal");
const manilaExplainModalCloseBtn = document.getElementById("manilaExplainModalCloseBtn");
const manilaExplainContent = document.getElementById("manilaExplainContent");

const MANILA_CARGO_META = {
  nutmeg: { label: "Nutmeg", icon: "🟫", accent: "nutmeg" },
  silk: { label: "Silk", icon: "🟨", accent: "silk" },
  ginseng: { label: "Ginseng", icon: "🟩", accent: "ginseng" },
  jade: { label: "Jade", icon: "🟦", accent: "jade" },
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

function getCargoList(view) {
  if (!view) {
    return ["nutmeg", "silk", "ginseng", "jade"];
  }
  const cargos = new Set();
  if (view.price_track) {
    Object.keys(view.price_track).forEach((key) => cargos.add(key));
  }
  if (Array.isArray(view.cargo_slots)) {
    view.cargo_slots.forEach((key) => cargos.add(key));
  }
  Object.keys(view.boats || {}).forEach((key) => cargos.add(key));
  return cargos.size ? Array.from(cargos) : ["nutmeg", "silk", "ginseng", "jade"];
}

function getCargoMeta(cargo) {
  return MANILA_CARGO_META[cargo] || { label: cargo, icon: "⬜", accent: "neutral" };
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

function createSlotButton({ label, meta, occupant, onClick, disabled }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "manila-slot";
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
  if (!view || !view.boats) {
    return;
  }
  const entries = Object.entries(view.boats);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "manila-empty";
    empty.textContent = "No boats yet";
    manilaBoats.appendChild(empty);
    return;
  }
  const canPlace = canPlaceWorker(view);
  entries.forEach(([cargoId, boat]) => {
    const meta = getCargoMeta(cargoId);
    const card = document.createElement("div");
    card.className = `manila-boat-card manila-cargo-${meta.accent}`;

    const header = document.createElement("div");
    header.className = "manila-boat-header";
    const chip = document.createElement("div");
    chip.className = `manila-cargo-chip manila-cargo-${meta.accent}`;
    chip.textContent = `${meta.icon} ${meta.label || cargoId}`;
    const value = document.createElement("div");
    value.className = "manila-boat-value";
    value.textContent = `💰 ${boat.total_value ?? 0}`;
    header.appendChild(chip);
    header.appendChild(value);
    card.appendChild(header);

    const track = document.createElement("div");
    track.className = "manila-track";
    for (let i = 0; i <= 13; i += 1) {
      const dot = document.createElement("div");
      dot.className = "manila-track-dot";
      if (i === 13) {
        dot.classList.add("port");
      }
      if (i === (boat.position ?? 0)) {
        dot.classList.add("active");
      }
      if (i === 0 || i === 5 || i === 10 || i === 13) {
        dot.textContent = String(i);
      }
      dot.title = `Position ${i}`;
      track.appendChild(dot);
    }
    card.appendChild(track);

    const seatWrap = document.createElement("div");
    seatWrap.className = "manila-seat-grid";
    const seats = Array.isArray(boat.seats) ? boat.seats : [];
    const costs = Array.isArray(boat.seat_costs) ? boat.seat_costs : [];
    costs.forEach((cost, idx) => {
      const seatBtn = document.createElement("button");
      seatBtn.type = "button";
      seatBtn.className = "manila-seat";
      const occupant = seats[idx];
      const occupantLabel = occupant ? formatManilaSeat(occupant, view) : "Empty";
      seatBtn.innerHTML = `
        <span class=\"manila-seat-title\">Seat ${idx + 1}</span>
        <span class=\"manila-seat-meta\">🪙 ${cost}</span>
        <span class=\"manila-seat-occupant\">${occupantLabel}</span>
      `;
      seatBtn.addEventListener("click", () =>
        sendAction({ type: "place_worker", location: { type: "ship", cargo: cargoId, seat: idx } })
      );
      setDisabled(seatBtn, !canPlace || !!occupant);
      seatWrap.appendChild(seatBtn);
    });
    card.appendChild(seatWrap);

    const flags = [];
    if (boat.plundered) flags.push("plundered");
    if (boat.safe_from_pirates) flags.push("safe");
    if (boat.skip_roll) flags.push("arrived");
    const footer = document.createElement("div");
    footer.className = "manila-boat-footer";
    footer.textContent = flags.length ? `Flags: ${flags.join(", ")}` : "Flags: -";
    card.appendChild(footer);

    manilaBoats.appendChild(card);
  });
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
  rolesGrid.appendChild(
    createSlotButton({
      label: "Captain",
      meta: `🪙 ${MANILA_BOARD_VALUES.pirates.cost}`,
      occupant: pirates.captain ? formatManilaSeat(pirates.captain, view) : "",
      disabled: !canPlace || !!pirates.captain,
      onClick: () => sendAction({ type: "place_worker", location: { type: "pirate", slot: "captain" } }),
    })
  );
  rolesGrid.appendChild(
    createSlotButton({
      label: "Pirate",
      meta: `🪙 ${MANILA_BOARD_VALUES.pirates.cost}`,
      occupant: pirates.pirate ? formatManilaSeat(pirates.pirate, view) : "",
      disabled: !canPlace || !!pirates.pirate,
      onClick: () => sendAction({ type: "place_worker", location: { type: "pirate", slot: "pirate" } }),
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
    })
  );
  rolesGrid.appendChild(
    createSlotButton({
      label: "Pilot (Small)",
      meta: `🪙 ${MANILA_BOARD_VALUES.pilots.small}`,
      occupant: pilots.small ? formatManilaSeat(pilots.small, view) : "",
      disabled: !canPlace || !!pilots.small,
      onClick: () => sendAction({ type: "place_worker", location: { type: "pilot", size: "small" } }),
    })
  );
  rolesZone.appendChild(rolesGrid);

  const insuranceZone = document.createElement("div");
  insuranceZone.className = "manila-zone manila-zone-insurance";
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
    })
  );
  insuranceZone.appendChild(insuranceGrid);

  map.appendChild(portZone);
  map.appendChild(shipyardZone);
  map.appendChild(rolesZone);
  map.appendChild(insuranceZone);
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
    manilaAuctionInfo.textContent = `Highest bid ${view.auction.highest_bid ?? 0} · Leader ${leader}`;
  }
}

function updatePayBidActions(view) {
  const visible = view && view.phase === "harbormaster_pay";
  setVisible(document.getElementById("manilaPayBidGroup"), visible);
  if (!visible) {
    return;
  }
  const isMyTurn = view.current_player === view.you;
  setDisabled(manilaPayBidBtn, !isMyTurn);
}

function updatePledgeActions(view) {
  setVisible(document.getElementById("manilaPledgeGroup"), !!view);
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
    btn.textContent = `Buy ${cargo} (${cost})`;
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
    btn.textContent = cargo;
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
    label.textContent = cargo;
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
  setVisible(manilaPlacementGroup, visible);
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
  setDisabled(manilaPirateBoardBtn, !isMyTurn || !(view.pirate_targets || []).length);
  const canPlunder = pirates.captain === view.you;
  setDisabled(manilaPiratePlunderBtn, !isMyTurn || !canPlunder || !(view.pirate_targets || []).length);
  setDisabled(manilaPirateSkipBtn, !isMyTurn);
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
  renderManilaBoats(view);
  renderManilaBoard(view);
  renderManilaPlayers(view);
  updateActions(view);
}

function clearManilaState() {
  currentManilaView = null;
  manilaSelectedCargo = [];
  if (manilaPhaseLabel) manilaPhaseLabel.textContent = "-";
  if (manilaRoundLabel) manilaRoundLabel.textContent = "-";
  if (manilaCurrentLabel) manilaCurrentLabel.textContent = "-";
  if (manilaHarborLabel) manilaHarborLabel.textContent = "-";
  if (manilaHarborBidLabel) manilaHarborBidLabel.textContent = "-";
  if (manilaPricesLabel) manilaPricesLabel.textContent = "-";
  if (manilaBoats) manilaBoats.innerHTML = "";
  if (manilaBoard) manilaBoard.innerHTML = "";
  if (manilaPlayers) manilaPlayers.innerHTML = "";
  if (manilaLegalActions) manilaLegalActions.textContent = "-";
  if (manilaAuctionInfo) manilaAuctionInfo.textContent = "";
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
if (manilaPayBidBtn) {
  manilaPayBidBtn.addEventListener("click", () => sendAction({ type: "pay_bid" }));
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
    sendAction({ type: "pirate_action", mode: "plunder", cargo: manilaPirateTargetSelect.value })
  );
}
if (manilaPirateSkipBtn) {
  manilaPirateSkipBtn.addEventListener("click", () => sendAction({ type: "pirate_action", mode: "skip" }));
}

window.renderManilaGameState = renderManilaGameState;
window.clearManilaState = clearManilaState;
