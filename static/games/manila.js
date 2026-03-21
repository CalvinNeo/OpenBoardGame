let currentManilaView = null;

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
const manilaActionType = document.getElementById("manilaActionType");
const manilaActionPayload = document.getElementById("manilaActionPayload");
const manilaActionSendBtn = document.getElementById("manilaActionSendBtn");

const MANILA_ACTION_TEMPLATES = {
  bid: { amount: 5 },
  pass_bid: {},
  pay_bid: {},
  buy_stock: { cargo: "nutmeg" },
  skip_buy: {},
  select_cargo: { cargo: ["nutmeg", "silk", "jade"] },
  set_positions: { positions: [0, 4, 5] },
  place_worker: { location: { type: "port", slot: "A" } },
  pass: {},
  pledge_stock: { cargo: "nutmeg" },
  pilot_move: { size: "small", cargo: "silk", delta: 1 },
  pilot_split: { size: "big", cargo_a: "silk", delta_a: 1, cargo_b: "jade", delta_b: -1 },
  pirate_action: { mode: "board", cargo: "silk" },
  play_again: {},
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

function updateManilaActionOptions(view) {
  if (!manilaActionType) {
    return;
  }
  const legal = view && Array.isArray(view.legal_actions) ? view.legal_actions : null;
  const actions = legal && legal.length ? legal : Object.keys(MANILA_ACTION_TEMPLATES);
  manilaActionType.innerHTML = "";
  actions.forEach((action) => {
    const opt = document.createElement("option");
    opt.value = action;
    opt.textContent = action;
    manilaActionType.appendChild(opt);
  });
  if (manilaActionPayload) {
    const first = actions[0];
    const template = MANILA_ACTION_TEMPLATES[first] || {};
    manilaActionPayload.value = JSON.stringify(template, null, 2);
  }
}

function handleManilaActionTypeChange() {
  if (!manilaActionType || !manilaActionPayload) {
    return;
  }
  const action = manilaActionType.value;
  const template = MANILA_ACTION_TEMPLATES[action] || {};
  manilaActionPayload.value = JSON.stringify(template, null, 2);
}

function handleManilaActionSend() {
  if (!manilaActionType) {
    return;
  }
  const type = manilaActionType.value;
  let payload = {};
  if (manilaActionPayload && manilaActionPayload.value.trim()) {
    try {
      payload = JSON.parse(manilaActionPayload.value);
    } catch (err) {
      log(`Invalid JSON: ${err}`);
      return;
    }
  }
  sendAction({ type, ...payload });
}

if (manilaActionType) {
  manilaActionType.addEventListener("change", handleManilaActionTypeChange);
}
if (manilaActionSendBtn) {
  manilaActionSendBtn.addEventListener("click", handleManilaActionSend);
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
  entries.forEach(([cargoId, boat]) => {
    const card = document.createElement("div");
    card.className = "manila-card";
    const title = document.createElement("div");
    title.className = "manila-card-title";
    title.textContent = `${cargoId} · pos ${boat.position ?? 0} · value ${boat.total_value ?? 0}`;
    card.appendChild(title);

    const seats = Array.isArray(boat.seats) ? boat.seats.map((seat) => formatManilaSeat(seat, view)) : [];
    const seatsLine = document.createElement("div");
    seatsLine.className = "manila-card-line";
    seatsLine.textContent = `Seats: ${seats.length ? seats.join(", ") : "-"}`;
    card.appendChild(seatsLine);

    const meta = document.createElement("div");
    meta.className = "manila-card-line";
    const flags = [];
    if (boat.plundered) {
      flags.push("plundered");
    }
    if (boat.safe_from_pirates) {
      flags.push("safe");
    }
    if (boat.skip_roll) {
      flags.push("arrived");
    }
    meta.textContent = flags.length ? `Flags: ${flags.join(", ")}` : "Flags: -";
    card.appendChild(meta);

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
  const sections = [];
  const port = board.port || {};
  sections.push({
    title: "Port",
    lines: ["A", "B", "C"].map((slot) => `${slot}: ${formatManilaSeat(port[slot], view)}`),
  });
  const shipyard = board.shipyard || {};
  sections.push({
    title: "Shipyard",
    lines: ["A", "B", "C"].map((slot) => `${slot}: ${formatManilaSeat(shipyard[slot], view)}`),
  });
  const pirates = board.pirates || {};
  sections.push({
    title: "Pirates",
    lines: [
      `Captain: ${formatManilaSeat(pirates.captain, view)}`,
      `Pirate: ${formatManilaSeat(pirates.pirate, view)}`,
    ],
  });
  const pilots = board.pilots || {};
  sections.push({
    title: "Pilots",
    lines: [
      `Big: ${formatManilaSeat(pilots.big, view)}`,
      `Small: ${formatManilaSeat(pilots.small, view)}`,
    ],
  });
  sections.push({
    title: "Insurance",
    lines: [`Holder: ${formatManilaSeat(board.insurance, view)}`],
  });

  sections.forEach((section) => {
    const card = document.createElement("div");
    card.className = "manila-card";
    const title = document.createElement("div");
    title.className = "manila-card-title";
    title.textContent = section.title;
    card.appendChild(title);
    section.lines.forEach((line) => {
      const entry = document.createElement("div");
      entry.className = "manila-card-line";
      entry.textContent = line;
      card.appendChild(entry);
    });
    manilaBoard.appendChild(card);
  });
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
    line1.textContent = `Cash: ${player.cash ?? 0} · Workers: ${player.workers_available ?? 0}/${player.workers_total ?? 0}`;
    card.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "manila-card-line";
    if (player.stocks) {
      const stockParts = Object.entries(player.stocks).map(([cargo, count]) => `${cargo}:${count}`);
      const pledgeParts = Object.entries(player.pledged || {}).map(([cargo, count]) => `${cargo}:${count}`);
      line2.textContent = `Stocks: ${stockParts.join(" ") || "-"} · Pledged: ${pledgeParts.join(" ") || "-"}`;
    } else {
      line2.textContent = `Stocks: ${player.stock_count ?? 0} · Pledged: ${player.pledged_count ?? 0}`;
    }
    card.appendChild(line2);

    manilaPlayers.appendChild(card);
  });
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
  updateManilaActionOptions(view);
}

function clearManilaState() {
  currentManilaView = null;
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
  if (manilaActionPayload) manilaActionPayload.value = "";
  if (manilaActionType) manilaActionType.innerHTML = "";
}

window.renderManilaGameState = renderManilaGameState;
window.clearManilaState = clearManilaState;
