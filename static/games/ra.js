let currentRaView = null;
let selectedRaAuctionTiles = new Set();
let selectedRaDisasterTiles = new Set();
let raExplainMode = false;
let raSuppressNextClick = false;

const raPhaseLabel = document.getElementById("raPhase");
const raEpochLabel = document.getElementById("raEpoch");
const raTurnLabel = document.getElementById("raTurn");
const raBagLabel = document.getElementById("raBag");
const raCenterDiskLabel = document.getElementById("raCenterDisk");
const raTrackCountLabel = document.getElementById("raTrackCount");
const raAuctionCountLabel = document.getElementById("raAuctionCount");
const raWinnerLabel = document.getElementById("raWinner");
const raTrackEl = document.getElementById("raTrack");
const raAuctionTrackEl = document.getElementById("raAuctionTrack");
const raAuctionBox = document.getElementById("raAuctionBox");
const raAuctionInfo = document.getElementById("raAuctionInfo");
const raBidButtons = document.getElementById("raBidButtons");
const raDisasterBox = document.getElementById("raDisasterBox");
const raDisasterInfo = document.getElementById("raDisasterInfo");
const raDisasterChoices = document.getElementById("raDisasterChoices");
const raResolveDisasterBtn = document.getElementById("raResolveDisasterBtn");
const raDrawBtn = document.getElementById("raDrawBtn");
const raInvokeBtn = document.getElementById("raInvokeBtn");
const raPlayGodBtn = document.getElementById("raPlayGodBtn");
const raPassBtn = document.getElementById("raPassBtn");
const raNextRoundBtn = document.getElementById("raNextRoundBtn");
const raSelectionLabel = document.getElementById("raSelectionLabel");
const raPlayersEl = document.getElementById("raPlayers");
const raEpochNotice = document.getElementById("raEpochNotice");
const raEpochNoticeTitle = document.getElementById("raEpochNoticeTitle");
const raEpochNoticeBody = document.getElementById("raEpochNoticeBody");
const raEpochNoticeList = document.getElementById("raEpochNoticeList");
const raHeaderActions = document.getElementById("raHeaderActions");
const raHelpBtn = document.getElementById("raHelpBtn");
const raExplainBtn = document.getElementById("raExplainBtn");
const raHelpModal = document.getElementById("raHelpModal");
const raExplainModal = document.getElementById("raExplainModal");
const raHelpModalCloseBtn = document.getElementById("raHelpModalCloseBtn");
const raExplainModalCloseBtn = document.getElementById("raExplainModalCloseBtn");
const raHelpContent = document.getElementById("raHelpContent");
const raExplainContent = document.getElementById("raExplainContent");

const RA_HELP_HTML = `
  <div class="rules-block">
    <p>Ra is played across 3 epochs. On your turn, draw a tile, spend God tiles to take auction tiles, or invoke Ra to start an auction.</p>
    <p>☀️ Ra tiles advance the Ra track and force an auction. If the Ra track fills, the epoch ends immediately and auction tiles are discarded.</p>
    <p>In an auction, each player gets one chance to pass or bid one ready sun disk higher than the current bid. The winner takes all auction tiles and swaps the bid disk with the center disk, which comes back spent.</p>
    <p>Disasters force the winner to discard up to 2 matching tiles. Epoch scoring pauses until every player clicks Next Round.</p>
  </div>
`;

const RA_BUTTON_EXPLANATIONS = {
  raDrawBtn: {
    name: "Draw Tile",
    description:
      "Draw one tile from the bag. Normal tiles go to the auction track. A Ra tile goes to the Ra track and starts a forced auction unless it fills the Ra track, which ends the epoch immediately.",
  },
  raInvokeBtn: {
    name: "Invoke Ra",
    description:
      "Start a voluntary auction without drawing. If every other player passes, you must bid one of your ready sun disks.",
  },
  raPlayGodBtn: {
    name: "Play God",
    description:
      "Spend God tiles from your tableau to take selected non-God tiles from the auction track. Select auction tiles first, then click this button.",
  },
  raPassBtn: {
    name: "Pass",
    description:
      "Pass your single auction decision. In a voluntary auction, the invoking player cannot pass if nobody else has bid.",
  },
  raNextRoundBtn: {
    name: "Next Round",
    description:
      "Confirm that you have reviewed the epoch scoring. The next epoch starts only after every player clicks Next Round.",
  },
  raResolveDisasterBtn: {
    name: "Resolve Disaster",
    description:
      "Confirm the tiles you must discard for disasters. You must select the exact number and matching types shown in the disaster box.",
  },
};

const RA_DYNAMIC_EXPLANATIONS = {
  bidDisk: {
    name: "Bid Sun Disk",
    description:
      "Bid this ready sun disk in the current auction. The bid must be higher than the current high bid. If you win, this disk moves to the center and you take the old center disk spent.",
  },
  auctionTile: {
    name: "Auction Tile",
    description:
      "Select this tile when using a God tile. God cannot take another God tile. Auction tiles are otherwise won together through auctions.",
  },
  disasterTile: {
    name: "Disaster Discard",
    description:
      "Select this tile as a discard target for the pending disaster. War hits Pharaohs, Drought hits rivers, Funeral hits civilizations, and Earthquake hits monuments.",
  },
};

const RA_TILE_META = {
  ra: ["☀️", "Ra"],
  god: ["⚡", "God"],
  gold: ["🟨", "Gold"],
  pharaoh: ["👑", "Pharaoh"],
  nile: ["🟦", "Nile"],
  flood: ["🌊", "Flood"],
  astronomy: ["🔭", "Astronomy"],
  agriculture: ["🌾", "Agriculture"],
  writing: ["📜", "Writing"],
  religion: ["🛕", "Religion"],
  art: ["🎨", "Art"],
  fortress: ["🏰", "Fortress"],
  obelisk: ["🗿", "Obelisk"],
  palace: ["🏛️", "Palace"],
  pyramid: ["🔺", "Pyramid"],
  sphinx: ["🟫", "Sphinx"],
  statue: ["🗽", "Statue"],
  temple: ["⛩️", "Temple"],
  step_pyramid: ["🧱", "Step Pyramid"],
  war: ["⚔️", "War"],
  drought: ["🏜️", "Drought"],
  funeral: ["⚱️", "Funeral"],
  earthquake: ["💥", "Earthquake"],
};

function raTileLabel(tile) {
  const meta = RA_TILE_META[tile && tile.kind] || ["■", (tile && tile.label) || "Tile"];
  const groupLabel = {
    ra: "Ra",
    god: "God",
    gold: "Gold",
    pharaoh: "Pharaoh",
    river: "River",
    civilization: "Civilization",
    monument: "Monument",
    disaster: "Disaster",
  }[(tile && tile.group) || ""];
  return `${meta[0]} ${meta[1]}${groupLabel ? ` (${groupLabel})` : ""}`;
}

function raFindPlayer(view, playerId) {
  return (view.players || []).find((player) => player.player_id === playerId);
}

function raPlayerName(view, playerId) {
  const player = raFindPlayer(view, playerId);
  return (player && player.name) || playerId || "-";
}

function raLegal(actionType) {
  return Boolean(currentRaView && Array.isArray(currentRaView.legal_actions) && currentRaView.legal_actions.includes(actionType));
}

function raYourPlayer() {
  if (!currentRaView) {
    return null;
  }
  return raFindPlayer(currentRaView, currentRaView.you);
}

function clearRaSelections() {
  selectedRaAuctionTiles.clear();
  selectedRaDisasterTiles.clear();
}

function clearRaState() {
  currentRaView = null;
  clearRaSelections();
  exitRaExplainMode();
  [
    raPhaseLabel,
    raEpochLabel,
    raTurnLabel,
    raBagLabel,
    raCenterDiskLabel,
    raTrackCountLabel,
    raAuctionCountLabel,
    raWinnerLabel,
  ].forEach((el) => {
    if (el) {
      el.textContent = "-";
    }
  });
  [raTrackEl, raAuctionTrackEl, raBidButtons, raDisasterChoices, raPlayersEl, raEpochNoticeList].forEach((el) => {
    if (el) {
      el.innerHTML = "";
    }
  });
  [raAuctionBox, raDisasterBox, raEpochNotice].forEach((el) => {
    if (el) {
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
    }
  });
  if (raSelectionLabel) {
    raSelectionLabel.textContent = "Selected: -";
  }
  if (raHelpModal) {
    setModalVisible(raHelpModal, false);
  }
  if (raExplainModal) {
    setModalVisible(raExplainModal, false);
  }
  updateRaButtons();
}

function showRaHeaderActions(show) {
  if (!raHeaderActions) {
    return;
  }
  raHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    exitRaExplainMode();
    if (raHelpModal) {
      setModalVisible(raHelpModal, false);
    }
    if (raExplainModal) {
      setModalVisible(raExplainModal, false);
    }
  }
}

function openRaHelpModal() {
  if (!raHelpModal || !raHelpContent) {
    return;
  }
  raHelpContent.innerHTML = RA_HELP_HTML;
  setModalVisible(raHelpModal, true);
}

function raExplanationForKey(key) {
  return RA_BUTTON_EXPLANATIONS[key] || RA_DYNAMIC_EXPLANATIONS[key] || null;
}

function updateRaExplainModeClasses(enabled) {
  Object.keys(RA_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.toggle("has-explanation", enabled);
    }
  });
  document.querySelectorAll("[data-ra-explain-key]").forEach((el) => {
    el.classList.toggle("has-explanation", enabled);
  });
}

function toggleRaExplainMode() {
  raExplainMode = !raExplainMode;
  document.body.classList.toggle("ra-explain-mode", raExplainMode);
  updateRaExplainModeClasses(raExplainMode);
  if (raExplainBtn) {
    raExplainBtn.classList.toggle("active", raExplainMode);
  }
}

function exitRaExplainMode() {
  if (!raExplainMode) {
    return;
  }
  raExplainMode = false;
  document.body.classList.remove("ra-explain-mode");
  updateRaExplainModeClasses(false);
  if (raExplainBtn) {
    raExplainBtn.classList.remove("active");
  }
}

function showRaButtonExplanation(key) {
  const explanation = raExplanationForKey(key);
  if (!explanation || !raExplainModal || !raExplainContent) {
    return;
  }
  raExplainContent.innerHTML = `
    <div class="rules-block">
      <h4>${explanation.name}</h4>
      <p>${explanation.description}</p>
    </div>
  `;
  setModalVisible(raExplainModal, true);
}

function findRaExplainTargetAtPoint(x, y) {
  for (const buttonId of Object.keys(RA_BUTTON_EXPLANATIONS)) {
    const button = document.getElementById(buttonId);
    if (!button) {
      continue;
    }
    const rect = button.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  const dynamicTargets = document.querySelectorAll("[data-ra-explain-key]");
  for (const target of dynamicTargets) {
    const rect = target.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return target.dataset.raExplainKey;
    }
  }
  return null;
}

function updateRaButtons() {
  const actionButtons = [
    [raDrawBtn, "draw_tile"],
    [raInvokeBtn, "invoke_ra"],
    [raPassBtn, "pass"],
    [raNextRoundBtn, "next_round"],
  ];
  actionButtons.forEach(([button, actionType]) => {
    if (!button) {
      return;
    }
    const allowed = raLegal(actionType);
    button.disabled = !allowed;
    button.classList.toggle("action-allowed", allowed);
  });
  if (raPlayGodBtn) {
    const allowed = raLegal("play_god") && selectedRaAuctionTiles.size > 0;
    raPlayGodBtn.disabled = !allowed;
    raPlayGodBtn.classList.toggle("action-allowed", allowed);
  }
  if (raResolveDisasterBtn) {
    const allowed = raLegal("resolve_disaster");
    raResolveDisasterBtn.disabled = !allowed;
    raResolveDisasterBtn.classList.toggle("action-allowed", allowed);
  }
  if (raSelectionLabel) {
    const auction = selectedRaAuctionTiles.size ? `${selectedRaAuctionTiles.size} auction tile(s)` : "";
    const disaster = selectedRaDisasterTiles.size ? `${selectedRaDisasterTiles.size} discard tile(s)` : "";
    raSelectionLabel.textContent = `Selected: ${[auction, disaster].filter(Boolean).join(" · ") || "-"}`;
  }
}

function makeRaTile(tile, options = {}) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `ra-tile ra-tile-${(tile && tile.group) || "unknown"}`;
  chip.textContent = raTileLabel(tile);
  chip.title = (tile && tile.label) || "";
  if (options.selected) {
    chip.classList.add("selected");
  }
  if (options.explainKey) {
    chip.dataset.raExplainKey = options.explainKey;
    chip.classList.toggle("has-explanation", raExplainMode);
  }
  if (!options.clickable) {
    chip.disabled = true;
  } else {
    chip.addEventListener("click", options.onClick);
  }
  return chip;
}

function renderRaTrack(view) {
  if (!raTrackEl || !raAuctionTrackEl) {
    return;
  }
  raTrackEl.innerHTML = "";
  const raLimit = view.ra_limit || 0;
  raTrackEl.style.setProperty("--ra-track-count", String(raLimit || 1));
  for (let idx = 0; idx < raLimit; idx += 1) {
    const slot = document.createElement("div");
    slot.className = "ra-slot";
    slot.classList.toggle("filled", idx < (view.ra_track || []).length);
    slot.classList.toggle("finish", idx === raLimit - 1);
    const marker = document.createElement("span");
    marker.className = "ra-slot-marker";
    marker.textContent = idx < (view.ra_track || []).length ? "☀️" : String(idx + 1);
    const label = document.createElement("span");
    label.className = "ra-slot-label";
    label.textContent = idx === raLimit - 1 ? "End" : "";
    slot.append(marker, label);
    raTrackEl.appendChild(slot);
  }

  raAuctionTrackEl.innerHTML = "";
  const auctionTiles = view.auction_track || [];
  const auctionLimit = view.auction_limit || 8;
  raAuctionTrackEl.style.setProperty("--ra-track-count", String(auctionLimit));
  for (let idx = 0; idx < auctionLimit; idx += 1) {
    const tile = auctionTiles[idx];
    const slot = document.createElement("div");
    slot.className = "ra-auction-slot";
    slot.classList.toggle("filled", Boolean(tile));
    slot.classList.toggle("finish", idx === auctionLimit - 1);
    const index = document.createElement("span");
    index.className = "ra-auction-index";
    index.textContent = String(idx + 1);
    slot.appendChild(index);
    if (tile) {
      const clickable = raLegal("play_god") && tile.kind !== "god";
      const chip = makeRaTile(tile, {
        clickable,
        explainKey: clickable ? "auctionTile" : null,
        selected: selectedRaAuctionTiles.has(tile.id),
        onClick: () => {
          if (selectedRaAuctionTiles.has(tile.id)) {
            selectedRaAuctionTiles.delete(tile.id);
          } else {
            selectedRaAuctionTiles.add(tile.id);
          }
          renderRaGameState({ view: currentRaView, events: [] });
        },
      });
      slot.appendChild(chip);
    } else {
      const empty = document.createElement("span");
      empty.className = "ra-empty-label";
      empty.textContent = idx === auctionLimit - 1 ? "Full" : "";
      slot.appendChild(empty);
    }
    raAuctionTrackEl.appendChild(slot);
  }
}

function renderRaAuction(view) {
  if (!raAuctionBox || !raAuctionInfo || !raBidButtons) {
    return;
  }
  const auction = view.auction;
  const visible = view.phase === "auction" && auction;
  raAuctionBox.classList.toggle("hidden", !visible);
  raAuctionBox.setAttribute("aria-hidden", (!visible).toString());
  raBidButtons.innerHTML = "";
  if (!visible) {
    return;
  }
  const bids = auction.bids || {};
  const currentBid = Math.max(0, ...Object.values(bids).map((value) => Number(value) || 0));
  raAuctionInfo.textContent = `${auction.forced ? "Forced auction" : "Voluntary auction"} · Current bid ${currentBid || "-"} · Bidder ${raPlayerName(view, view.current_turn)}`;
  const you = raYourPlayer();
  const disks = you && Array.isArray(you.sun_disks) ? you.sun_disks : [];
  disks.forEach((disk) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ra-sun-disk";
    button.dataset.raExplainKey = "bidDisk";
    button.textContent = `☀️ ${disk.value}`;
    const allowed = raLegal("bid") && disk.ready && Number(disk.value) > currentBid;
    button.disabled = !allowed;
    button.classList.toggle("action-allowed", allowed);
    button.classList.toggle("has-explanation", raExplainMode);
    button.addEventListener("click", () => sendAction({ type: "bid", disk: Number(disk.value) }));
    raBidButtons.appendChild(button);
  });
}

function renderRaDisaster(view) {
  if (!raDisasterBox || !raDisasterInfo || !raDisasterChoices) {
    return;
  }
  const pending = view.pending_disaster;
  const visible = view.phase === "disaster" && pending && pending.player_id === view.you;
  raDisasterBox.classList.toggle("hidden", !visible);
  raDisasterBox.setAttribute("aria-hidden", (!visible).toString());
  raDisasterChoices.innerHTML = "";
  if (!visible) {
    return;
  }
  const requirements = pending.requirements || {};
  const requirementText = Object.entries(requirements)
    .map(([kind, count]) => `${RA_TILE_META[kind] ? RA_TILE_META[kind][1] : kind}: ${count}`)
    .join(" · ");
  raDisasterInfo.textContent = `Choose exact discard targets · ${requirementText}`;
  const you = raYourPlayer();
  (you && you.tiles ? you.tiles : []).forEach((tile) => {
    const chip = makeRaTile(tile, {
      clickable: true,
      explainKey: "disasterTile",
      selected: selectedRaDisasterTiles.has(tile.id),
      onClick: () => {
        if (selectedRaDisasterTiles.has(tile.id)) {
          selectedRaDisasterTiles.delete(tile.id);
        } else {
          selectedRaDisasterTiles.add(tile.id);
        }
        renderRaGameState({ view: currentRaView, events: [] });
      },
    });
    raDisasterChoices.appendChild(chip);
  });
}

function renderRaEpochNotice(view) {
  if (!raEpochNotice || !raEpochNoticeBody || !raEpochNoticeList) {
    return;
  }
  const summary = view.last_epoch_summary;
  const visible = Boolean(summary && (view.phase === "epoch_pause" || view.phase === "game_over"));
  raEpochNotice.classList.toggle("hidden", !visible);
  raEpochNotice.setAttribute("aria-hidden", (!visible).toString());
  raEpochNoticeList.innerHTML = "";
  if (!visible) {
    return;
  }
  if (raEpochNoticeTitle) {
    raEpochNoticeTitle.textContent = view.phase === "game_over" ? "Final Scoring" : "Epoch Scoring";
  }
  raEpochNoticeBody.textContent = `Epoch ${summary.epoch} · ${summary.reason || "scoring"}`;
  (summary.rows || []).forEach((row) => {
    const line = document.createElement("div");
    line.className = "ra-score-row";
    line.textContent = `${raPlayerName(view, row.player_id)}: ${row.delta >= 0 ? "+" : ""}${row.delta} = ${row.score} (${(row.details || []).join(", ")})`;
    raEpochNoticeList.appendChild(line);
  });
}

function renderRaPlayers(view) {
  if (!raPlayersEl) {
    return;
  }
  raPlayersEl.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card ra-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = `${player.name || player.player_id} · ${player.score} VP`;
    const disks = document.createElement("div");
    disks.className = "ra-disk-row";
    (player.sun_disks || []).forEach((disk) => {
      const chip = document.createElement("span");
      chip.className = "ra-disk-chip";
      chip.classList.toggle("spent", !disk.ready);
      chip.textContent = `☀️${disk.value}`;
      disks.appendChild(chip);
    });
    const tiles = document.createElement("div");
    tiles.className = "ra-player-tiles";
    (player.tiles || []).forEach((tile) => {
      tiles.appendChild(makeRaTile(tile, { clickable: false }));
    });
    if (!player.tiles || !player.tiles.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No tiles.";
      tiles.appendChild(empty);
    }
    const ready = document.createElement("div");
    ready.className = "hint";
    ready.textContent = view.phase === "epoch_pause" ? `Next Round: ${player.ready_for_next ? "ready" : "waiting"}` : "";
    card.append(name, disks, tiles, ready);
    raPlayersEl.appendChild(card);
  });
}

function renderRaGameState(data) {
  const view = data.view;
  currentRaView = view;
  if (currentGameType !== "ra") {
    currentGameType = "ra";
    setGamePanelVisibility("ra");
  }
  if (raPhaseLabel) {
    raPhaseLabel.textContent = view.phase || "-";
  }
  if (raEpochLabel) {
    raEpochLabel.textContent = view.epoch ?? "-";
  }
  if (raTurnLabel) {
    raTurnLabel.textContent = raPlayerName(view, view.current_turn);
  }
  if (raBagLabel) {
    raBagLabel.textContent = view.bag_count ?? "-";
  }
  if (raCenterDiskLabel) {
    raCenterDiskLabel.textContent = `☀️ ${view.center_disk ?? "-"}`;
  }
  if (raTrackCountLabel) {
    raTrackCountLabel.textContent = `${(view.ra_track || []).length}/${view.ra_limit || "-"}`;
  }
  if (raAuctionCountLabel) {
    raAuctionCountLabel.textContent = `${(view.auction_track || []).length}/${view.auction_limit || 8}`;
  }
  if (raWinnerLabel) {
    const winners = Array.isArray(view.winner) ? view.winner.map((pid) => raPlayerName(view, pid)).join(", ") : "";
    raWinnerLabel.textContent = winners || "-";
  }
  selectedRaAuctionTiles.forEach((tileId) => {
    if (!(view.auction_track || []).some((tile) => tile.id === tileId)) {
      selectedRaAuctionTiles.delete(tileId);
    }
  });
  const you = raYourPlayer();
  selectedRaDisasterTiles.forEach((tileId) => {
    if (!you || !(you.tiles || []).some((tile) => tile.id === tileId)) {
      selectedRaDisasterTiles.delete(tileId);
    }
  });
  renderRaTrack(view);
  renderRaAuction(view);
  renderRaDisaster(view);
  renderRaEpochNotice(view);
  renderRaPlayers(view);
  logGameEvents(data);
  updateRaButtons();
  updateRaExplainModeClasses(raExplainMode);
}

if (raDrawBtn) {
  raDrawBtn.addEventListener("click", () => sendAction({ type: "draw_tile" }));
}
if (raInvokeBtn) {
  raInvokeBtn.addEventListener("click", () => sendAction({ type: "invoke_ra" }));
}
if (raPassBtn) {
  raPassBtn.addEventListener("click", () => sendAction({ type: "pass" }));
}
if (raPlayGodBtn) {
  raPlayGodBtn.addEventListener("click", () => {
    sendAction({ type: "play_god", tile_ids: Array.from(selectedRaAuctionTiles) });
    selectedRaAuctionTiles.clear();
  });
}
if (raResolveDisasterBtn) {
  raResolveDisasterBtn.addEventListener("click", () => {
    sendAction({ type: "resolve_disaster", tile_ids: Array.from(selectedRaDisasterTiles) });
    selectedRaDisasterTiles.clear();
  });
}
if (raNextRoundBtn) {
  raNextRoundBtn.addEventListener("click", () => sendAction({ type: "next_round" }));
}
if (raHelpBtn) {
  raHelpBtn.addEventListener("click", openRaHelpModal);
}
if (raExplainBtn) {
  raExplainBtn.addEventListener("click", toggleRaExplainMode);
}
if (raHelpModalCloseBtn) {
  raHelpModalCloseBtn.addEventListener("click", () => setModalVisible(raHelpModal, false));
}
if (raExplainModalCloseBtn) {
  raExplainModalCloseBtn.addEventListener("click", () => setModalVisible(raExplainModal, false));
}
[raHelpModal, raExplainModal].forEach((modal) => {
  if (!modal) {
    return;
  }
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      setModalVisible(modal, false);
    }
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (raExplainMode) {
    exitRaExplainMode();
  }
  if (raHelpModal && !raHelpModal.classList.contains("hidden")) {
    setModalVisible(raHelpModal, false);
  }
  if (raExplainModal && !raExplainModal.classList.contains("hidden")) {
    setModalVisible(raExplainModal, false);
  }
});
document.addEventListener(
  "pointerdown",
  (event) => {
    if (!raExplainMode) {
      return;
    }
    const button = event.target.closest("button");
    if (
      button === raExplainBtn ||
      button === raHelpBtn ||
      button === raHelpModalCloseBtn ||
      button === raExplainModalCloseBtn
    ) {
      return;
    }

    const explainKey = findRaExplainTargetAtPoint(event.clientX, event.clientY);
    if (explainKey) {
      event.preventDefault();
      event.stopPropagation();
      raSuppressNextClick = true;
      showRaButtonExplanation(explainKey);
      exitRaExplainMode();
      return;
    }

    if (button) {
      event.preventDefault();
      event.stopPropagation();
      raSuppressNextClick = true;
    }
  },
  true
);
document.addEventListener("click", (event) => {
  if (raSuppressNextClick) {
    event.preventDefault();
    event.stopPropagation();
    raSuppressNextClick = false;
    return;
  }
  if (raExplainMode) {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    if (
      button === raExplainBtn ||
      button === raHelpBtn ||
      button === raHelpModalCloseBtn ||
      button === raExplainModalCloseBtn
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!currentRaView || currentGameType !== "ra") {
    return;
  }
  const panel = document.getElementById("raPanel");
  if (!panel || !panel.contains(event.target)) {
    clearRaSelections();
    updateRaButtons();
  }
}, true);

window.clearRaState = clearRaState;
window.renderRaGameState = renderRaGameState;
window.showRaHeaderActions = showRaHeaderActions;
