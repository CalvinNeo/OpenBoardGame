let currentRaView = null;
let selectedRaAuctionTiles = new Set();
let selectedRaDisasterTiles = new Set();

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

function buildRaExplainHtml(view) {
  if (!view) {
    return "<p>No active Ra state.</p>";
  }
  const legal = (view.legal_actions || []).join(", ") || "none";
  const auction = view.auction
    ? `<p>Auction: ${view.auction.forced ? "forced" : "voluntary"}, current bidder ${raPlayerName(view, view.current_turn)}.</p>`
    : "";
  const disaster = view.pending_disaster
    ? `<p>Disaster: ${Object.entries(view.pending_disaster.requirements || {})
        .map(([kind, count]) => `${RA_TILE_META[kind] ? RA_TILE_META[kind][1] : kind} ${count}`)
        .join(", ")}.</p>`
    : "";
  return `
    <div class="rules-block">
      <p>Phase: ${view.phase}. Epoch ${view.epoch}. Legal actions for you: ${legal}.</p>
      <p>Draw Tile adds to the auction track unless it is ☀️ Ra, which advances the Ra track and starts a forced auction.</p>
      <p>Invoke Ra starts a voluntary auction. If everyone passes, the invoker must bid.</p>
      <p>Play God uses selected ⚡ God tiles from your tableau to take selected non-God auction tiles.</p>
      ${auction}
      ${disaster}
    </div>
  `;
}

function openRaExplainModal() {
  if (!raExplainModal || !raExplainContent) {
    return;
  }
  raExplainContent.innerHTML = buildRaExplainHtml(currentRaView);
  setModalVisible(raExplainModal, true);
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
  for (let idx = 0; idx < (view.ra_limit || 0); idx += 1) {
    const slot = document.createElement("div");
    slot.className = "ra-slot";
    slot.textContent = idx < (view.ra_track || []).length ? "☀️" : "";
    raTrackEl.appendChild(slot);
  }

  raAuctionTrackEl.innerHTML = "";
  const auctionTiles = view.auction_track || [];
  for (let idx = 0; idx < (view.auction_limit || 8); idx += 1) {
    const tile = auctionTiles[idx];
    const slot = document.createElement("div");
    slot.className = "ra-auction-slot";
    if (tile) {
      const clickable = raLegal("play_god") && tile.kind !== "god";
      const chip = makeRaTile(tile, {
        clickable,
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
    button.textContent = `☀️ ${disk.value}`;
    const allowed = raLegal("bid") && disk.ready && Number(disk.value) > currentBid;
    button.disabled = !allowed;
    button.classList.toggle("action-allowed", allowed);
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
  raExplainBtn.addEventListener("click", openRaExplainModal);
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
  if (raHelpModal && !raHelpModal.classList.contains("hidden")) {
    setModalVisible(raHelpModal, false);
  }
  if (raExplainModal && !raExplainModal.classList.contains("hidden")) {
    setModalVisible(raExplainModal, false);
  }
});
document.addEventListener("click", (event) => {
  if (!currentRaView || currentGameType !== "ra") {
    return;
  }
  const panel = document.getElementById("raPanel");
  if (!panel || !panel.contains(event.target)) {
    clearRaSelections();
    updateRaButtons();
  }
});

window.clearRaState = clearRaState;
window.renderRaGameState = renderRaGameState;
window.showRaHeaderActions = showRaHeaderActions;
