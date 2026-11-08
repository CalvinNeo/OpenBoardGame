let currentRaView = null;
let selectedRaAuctionTiles = new Set();
let selectedRaDisasterTiles = new Set();
let currentRaDisasterKey = null;
let raExplainMode = false;
let raSuppressNextClick = false;
let raTipTimer = null;
let raPointerStart = null;
let raPointerMoved = false;

const raPanelEl = document.getElementById("raPanel");
const raEpochLabel = document.getElementById("raEpoch");
const raPhaseLabel = document.getElementById("raPhase");
const raTurnLabel = document.getElementById("raTurn");
const raBagLabel = document.getElementById("raBag");
const raCenterDiskLabel = document.getElementById("raCenterDisk");
const raTrackCountLabel = document.getElementById("raTrackCount");
const raAuctionCountLabel = document.getElementById("raAuctionCount");
const raTurnPill = document.getElementById("raTurnPill");
const raPhasePill = document.getElementById("raPhasePill");
const raTurnNamePill = document.getElementById("raTurnNamePill");
const raTrackEl = document.getElementById("raTrack");
const raTrackMeta = document.getElementById("raTrackMeta");
const raAuctionTrackEl = document.getElementById("raAuctionTrack");
const raAuctionMeta = document.getElementById("raAuctionMeta");
const raGodBar = document.getElementById("raGodBar");
const raGodBarText = document.getElementById("raGodBarText");
const raGodCancelBtn = document.getElementById("raGodCancelBtn");
const raAuctionBox = document.getElementById("raAuctionBox");
const raAuctionTitle = document.getElementById("raAuctionTitle");
const raAuctionBid = document.getElementById("raAuctionBid");
const raAuctionOrder = document.getElementById("raAuctionOrder");
const raBidButtons = document.getElementById("raBidButtons");
const raDisasterBox = document.getElementById("raDisasterBox");
const raDisasterMeta = document.getElementById("raDisasterMeta");
const raDisasterInfo = document.getElementById("raDisasterInfo");
const raDisasterChoices = document.getElementById("raDisasterChoices");
const raResolveDisasterBtn = document.getElementById("raResolveDisasterBtn");
const raActionBar = document.getElementById("raActionBar");
const raDrawBtn = document.getElementById("raDrawBtn");
const raInvokeBtn = document.getElementById("raInvokeBtn");
const raPlayGodBtn = document.getElementById("raPlayGodBtn");
const raPassBtn = document.getElementById("raPassBtn");
const raNextRoundBtn = document.getElementById("raNextRoundBtn");
const raPlayersEl = document.getElementById("raPlayers");
const raPlayersMeta = document.getElementById("raPlayersMeta");
const raEpochNotice = document.getElementById("raEpochNotice");
const raEpochNoticeTitle = document.getElementById("raEpochNoticeTitle");
const raEpochNoticeBody = document.getElementById("raEpochNoticeBody");
const raEpochNoticeList = document.getElementById("raEpochNoticeList");
const raReadyState = document.getElementById("raReadyState");
const raHeaderActions = document.getElementById("raHeaderActions");
const raHelpBtn = document.getElementById("raHelpBtn");
const raExplainBtn = document.getElementById("raExplainBtn");
const raHelpModal = document.getElementById("raHelpModal");
const raExplainModal = document.getElementById("raExplainModal");
const raHelpModalCloseBtn = document.getElementById("raHelpModalCloseBtn");
const raExplainModalCloseBtn = document.getElementById("raExplainModalCloseBtn");
const raHelpContent = document.getElementById("raHelpContent");
const raExplainContent = document.getElementById("raExplainContent");

const raTipEl = document.createElement("div");
raTipEl.className = "ra-tip";
raTipEl.hidden = true;
raTipEl.setAttribute("role", "status");
document.body.appendChild(raTipEl);

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

const RA_GROUP_LABELS = {
  ra: "Ra",
  god: "Divine",
  gold: "Treasure",
  pharaoh: "Dynasty",
  river: "River",
  civilization: "Civilization",
  monument: "Monument",
  disaster: "Disaster",
};

const RA_GROUP_TIPS = {
  god: "God (⚡): +2 each at every epoch end, then discarded. Spend one to take a tile from the auction track.",
  gold: "Gold (🟨): +3 each at every epoch end, then discarded.",
  pharaoh: "Pharaoh (👑): kept between epochs. Most Pharaohs +5, fewest −2 at every epoch end.",
  river: "River (🟦 Nile / 🌊 Flood): needs at least one Flood, then every Nile and Flood scores +1. Only Nile is kept.",
  civilization: "Civilization (🔭 🌾 📜 🛕 🎨): 3 kinds +5, 4 kinds +10, 5 kinds +15, none −5. Discarded after scoring.",
  monument: "Monument (🏰 🗿 🏛️ 🔺 🟫 🗽 ⛩️ 🧱): kept all game, scored only after epoch 3.",
  disaster: "Disaster (⚔️ 🏜️ ⚱️ 💥): the auction winner must discard matching tiles at once.",
};

const RA_SCORE_META = {
  Gods: ["⚡", "Gods", "Each God tile scores +2 at every epoch end."],
  Gold: ["🟨", "Gold", "Each Gold tile scores +3 at every epoch end."],
  River: ["🌊", "River", "With at least one Flood, every Nile and Flood scores +1."],
  Civilization: ["📜", "Civilization", "3 kinds +5, 4 kinds +10, 5 kinds +15, no civilization −5."],
  Pharaohs: ["👑", "Pharaohs", "Most Pharaohs +5, fewest −2, at every epoch end."],
  Monuments: ["🏛️", "Monuments", "Scored after epoch 3: 1 point per kind (7 kinds 10, 8 kinds 15) plus 3/4/5 of a kind for +5/+10/+15."],
  "Sun disks": ["☀️", "Sun disks", "Scored after epoch 3: highest total +5, lowest −5."],
};

const RA_PHASE_LABELS = {
  turn: "Your move",
  auction: "Auction",
  disaster: "Disaster",
  epoch_pause: "Epoch scoring",
  game_over: "Game over",
};

const RA_EPOCH_DISCARD_KINDS = new Set([
  "god",
  "gold",
  "flood",
  "astronomy",
  "agriculture",
  "writing",
  "religion",
  "art",
]);

const RA_DISASTER_TARGET_KINDS = {
  war: new Set(["pharaoh"]),
  drought: new Set(["nile", "flood"]),
  funeral: new Set(["astronomy", "agriculture", "writing", "religion", "art"]),
  earthquake: new Set([
    "fortress",
    "obelisk",
    "palace",
    "pyramid",
    "sphinx",
    "statue",
    "temple",
    "step_pyramid",
  ]),
};

const RA_DISASTER_TARGET_LABELS = {
  war: "Pharaoh",
  drought: "River",
  funeral: "Civilization",
  earthquake: "Monument",
};

const RA_EXPLANATIONS = {
  raDrawBtn: {
    name: "Draw Tile",
    description:
      "Draw one tile from the bag. Normal tiles land on the auction track and your turn ends. A Ra tile (☀️) advances the Ra track and forces an auction, or ends the epoch at once if it fills the track.",
  },
  raInvokeBtn: {
    name: "Invoke Ra ☀️",
    description:
      "Start a voluntary auction without drawing. If every other player passes, you must bid one of your ready sun disks. You take the Ra figure, so the next turn starts to your left.",
  },
  raPlayGodBtn: {
    name: "Play God ⚡",
    description:
      "Spend God tiles (⚡) from your collection to take the auction tiles you selected, one God per tile. A God can never take another God tile.",
  },
  raGodCancelBtn: {
    name: "Cancel",
    description: "Drop the current auction tile selection. Clicking empty space around the board does the same.",
  },
  raPassBtn: {
    name: "Pass",
    description:
      "Give up your single auction decision. In a voluntary auction the invoking player cannot pass while nobody else has bid.",
  },
  raNextRoundBtn: {
    name: "Next Round",
    description:
      "Confirm you have read the epoch scoring. The next epoch starts only after every player confirms.",
  },
  raResolveDisasterBtn: {
    name: "Resolve Disaster",
    description:
      "Confirm the tiles destroyed by the disasters you won. Select exactly the required number of matching tiles first.",
  },
  raTrack: {
    name: "Ra Track ☀️",
    description:
      "Every drawn Ra tile fills one slot. When the last slot fills, the epoch ends immediately: the auction row is discarded and no further bids count.",
  },
  auctionTrack: {
    name: "Auction Track 🏺",
    description:
      "Tiles available to the next auction winner, who takes all of them at once. Drawing is blocked once all 8 slots are full.",
  },
  auctionTile: {
    name: "Auction Tile",
    description:
      "Select this tile to take it with a God tile (⚡). Otherwise it leaves the board only when an auction winner takes the whole row.",
  },
  bidDisk: {
    name: "Bid Sun Disk ☀️",
    description:
      "Bid this ready disk. It must beat the current high bid. If you win, this disk moves to the center of the board and you take the old center disk back spent for the rest of the epoch.",
  },
  bidOrder: {
    name: "Bid Order",
    description:
      "Each player gets exactly one decision, starting to the left of the player who invoked Ra and ending with that player.",
  },
  disasterTile: {
    name: "Disaster Discard",
    description:
      "Select this tile as a discard target. War (⚔️) hits Pharaohs, Drought (🏜️) hits rivers, Funeral (⚱️) hits civilizations, Earthquake (💥) hits monuments.",
  },
  collection: {
    name: "Collection",
    description:
      "Tiles you own. Keep survives the epoch; the epoch-end group is scored and then removed from the game.",
  },
  sunDisks: {
    name: "Sun Disks ☀️",
    description:
      "Your bidding disks. A grey disk was spent this epoch and cannot bid again until the next epoch. Their values also score after epoch 3.",
  },
};

const RA_HELP_HTML = `
  <div class="rules-block">
    <h4>Goal</h4>
    <p>Ra is played over 3 epochs. You collect tiles by winning auctions and by spending God tiles, then score them at the end of every epoch. Highest total after epoch 3 wins; ties break on the single highest sun disk.</p>

    <h4>Your turn</h4>
    <p>On your turn you must do exactly one of these:</p>
    <ul>
      <li><b>Draw Tile</b> — take one tile from the bag. A normal tile goes to the Auction Track (🏺) and your turn ends. A Ra tile (☀️) fills a Ra Track slot and forces an auction.</li>
      <li><b>Play God ⚡</b> — spend one God tile per tile to take selected tiles straight from the Auction Track. A God cannot take another God.</li>
      <li><b>Invoke Ra ☀️</b> — start a voluntary auction without drawing. You must bid if everyone else passes.</li>
    </ul>

    <h4>Auction</h4>
    <p>Bidding starts to the left of the player holding Ra and ends with that player. Everyone has exactly one decision: bid one ready sun disk higher than the current bid, or pass.</p>
    <p>The winner takes every tile on the Auction Track, then swaps the disk they bid with the Center Sun (☀️) and takes the old center disk back spent for the rest of the epoch. If everyone passes in a forced auction, the tiles stay on the track.</p>

    <h4>Disasters</h4>
    <p>Disasters resolve immediately when you win them, and each forces you to discard 2 matching tiles (or all you have, if fewer):</p>
    <ul>
      <li>War (⚔️) → Pharaohs (👑)</li>
      <li>Drought (🏜️) → Rivers (🟦 🌊)</li>
      <li>Funeral (⚱️) → Civilizations (🔭 🌾 📜 🛕 🎨)</li>
      <li>Earthquake (💥) → Monuments (🏰 🗿 🏛️ 🔺 🟫 🗽 ⛩️ 🧱)</li>
    </ul>

    <h4>Epoch end</h4>
    <p>An epoch ends when the Ra Track fills or every sun disk has been spent. All players then confirm with Next Round.</p>

    <h4>Scoring every epoch</h4>
    <ul>
      <li>God (⚡): +2 each</li>
      <li>Gold (🟨): +3 each</li>
      <li>Pharaoh (👑): most +5, fewest −2 (no change if all equal)</li>
      <li>River (🟦 🌊): needs at least one Flood (🌊), then +1 per Nile and Flood</li>
      <li>Civilization (🔭 🌾 📜 🛕 🎨): 3 kinds +5, 4 kinds +10, 5 kinds +15, none −5</li>
    </ul>

    <h4>Scoring after epoch 3 only</h4>
    <ul>
      <li>Monuments (🏰 🗿 🏛️ 🔺 🟫 🗽 ⛩️ 🧱): 1 point per different kind (7 kinds 10, 8 kinds 15), plus +5 for 3 of a kind, +10 for 4, +15 for 5</li>
      <li>Sun disks (☀️): highest total +5, lowest −5</li>
    </ul>

    <h4>What survives an epoch</h4>
    <p>Kept: Pharaohs (👑), Nile (🟦), Monuments. Discarded after scoring: Gods (⚡), Gold (🟨), Floods (🌊), Civilizations. All sun disks flip back to ready.</p>

    <h4>Tile legend</h4>
    <div class="ra-legend">
      <span>☀️ Ra</span><span>⚡ God</span><span>🟨 Gold</span><span>👑 Pharaoh</span>
      <span>🟦 Nile</span><span>🌊 Flood</span><span>🔭 Astronomy</span><span>🌾 Agriculture</span>
      <span>📜 Writing</span><span>🛕 Religion</span><span>🎨 Art</span><span>🏰 Fortress</span>
      <span>🗿 Obelisk</span><span>🏛️ Palace</span><span>🔺 Pyramid</span><span>🟫 Sphinx</span>
      <span>🗽 Statue</span><span>⛩️ Temple</span><span>🧱 Step Pyramid</span>
      <span>⚔️ War</span><span>🏜️ Drought</span><span>⚱️ Funeral</span><span>💥 Earthquake</span>
    </div>
  </div>
`;

function raTileMeta(tile) {
  return RA_TILE_META[tile && tile.kind] || ["■", (tile && tile.label) || "Tile"];
}

function raTileClassToken(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
}

function raFindPlayer(view, playerId) {
  return (view.players || []).find((player) => player.player_id === playerId);
}

function raPlayerName(view, playerId) {
  const player = raFindPlayer(view, playerId);
  return (player && player.name) || playerId || "-";
}

function raLegal(actionType) {
  return Boolean(
    currentRaView &&
      Array.isArray(currentRaView.legal_actions) &&
      currentRaView.legal_actions.includes(actionType)
  );
}

function raYourPlayer() {
  if (!currentRaView) {
    return null;
  }
  return raFindPlayer(currentRaView, currentRaView.you);
}

function raHideTip() {
  window.clearTimeout(raTipTimer);
  raTipEl.hidden = true;
}

function raShowTip(text, anchor, touch) {
  if (!text || !anchor) {
    return;
  }
  window.clearTimeout(raTipTimer);
  raTipEl.textContent = text;
  raTipEl.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const box = raTipEl.getBoundingClientRect();
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const left = touch ? (viewWidth - box.width) / 2 : rect.left;
  let top;
  if (touch) {
    top = rect.top < viewHeight / 2 ? viewHeight - box.height - 12 : 12;
  } else {
    top = rect.top > box.height + 16 ? rect.top - box.height - 8 : rect.bottom + 8;
  }
  raTipEl.style.left = Math.max(10, Math.min(viewWidth - box.width - 10, left)) + "px";
  raTipEl.style.top = Math.max(10, Math.min(viewHeight - box.height - 10, top)) + "px";
  if (touch) {
    raTipTimer = window.setTimeout(raHideTip, 3000);
  }
}

function raBindTap(el, handler) {
  el.addEventListener("click", (event) => {
    if (raPointerMoved) {
      event.preventDefault();
      event.stopPropagation();
      raPointerMoved = false;
      return;
    }
    handler(event);
  });
}

function raDisasterKey(view) {
  const pending = view && view.pending_disaster;
  if (!pending || view.phase !== "disaster") {
    return null;
  }
  const disasters = (pending.disasters || []).map((tile) => tile.id || tile.kind).join(",");
  return (pending.player_id || "-") + "|" + disasters + "|" + JSON.stringify(pending.requirements || {});
}

function raFallbackDisasterGuide(view) {
  const pending = view && view.pending_disaster;
  const player = view ? raFindPlayer(view, pending && pending.player_id) : null;
  if (!pending || !player) {
    return null;
  }
  const groups = Object.entries(pending.requirements || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([disaster, count]) => {
      const targets = RA_DISASTER_TARGET_KINDS[disaster] || new Set();
      const eligible = (player.tiles || []).filter((tile) => targets.has(tile.kind));
      const required = Number(count) || 0;
      return {
        disaster,
        required,
        target_label: RA_DISASTER_TARGET_LABELS[disaster] || "matching",
        target_kinds: Array.from(targets),
        eligible_tile_ids: eligible.map((tile) => tile.id),
        recommended_tile_ids: eligible.slice(0, required).map((tile) => tile.id),
        recommendation: "Select the required number of affected tiles.",
        alternative_count: 0,
      };
    });
  return {
    required_total: groups.reduce((total, group) => total + group.required, 0),
    eligible_tile_ids: groups.flatMap((group) => group.eligible_tile_ids),
    recommended_tile_ids: groups.flatMap((group) => group.recommended_tile_ids),
    groups,
  };
}

function raDisasterGuide(view) {
  const pending = view && view.pending_disaster;
  if (!pending) {
    return null;
  }
  const guide = pending.guide;
  if (guide && Array.isArray(guide.groups)) {
    return guide;
  }
  return raFallbackDisasterGuide(view);
}

function raDisasterSelectionStatus(view) {
  const guide = raDisasterGuide(view);
  if (!guide || !Array.isArray(guide.groups) || !guide.groups.length) {
    return { valid: false, selected: 0, required: 0, groups: [] };
  }
  const eligible = new Set(guide.eligible_tile_ids || []);
  const groupStatuses = guide.groups.map((group) => {
    const groupIds = new Set(group.eligible_tile_ids || []);
    const selected = Array.from(selectedRaDisasterTiles).filter((tileId) => groupIds.has(tileId)).length;
    return { group, selected, required: Number(group.required) || 0 };
  });
  const selected = Array.from(selectedRaDisasterTiles).filter((tileId) => eligible.has(tileId)).length;
  const required = Number(guide.required_total) || groupStatuses.reduce((total, item) => total + item.required, 0);
  const containsOnlyEligible = Array.from(selectedRaDisasterTiles).every((tileId) => eligible.has(tileId));
  return {
    valid:
      containsOnlyEligible &&
      selected === required &&
      groupStatuses.every((item) => item.selected === item.required),
    selected,
    required,
    groups: groupStatuses,
  };
}

function raSyncDisasterSelection(view) {
  const nextKey = raDisasterKey(view);
  if (nextKey !== currentRaDisasterKey) {
    selectedRaDisasterTiles.clear();
    currentRaDisasterKey = nextKey;
  }
}

function clearRaSelections() {
  selectedRaAuctionTiles.clear();
  selectedRaDisasterTiles.clear();
}

function raNeedsAction(view) {
  if (!view || !Array.isArray(view.legal_actions) || !view.legal_actions.length) {
    return false;
  }
  return ["turn", "auction", "disaster", "epoch_pause"].includes(view.phase);
}

function clearRaState() {
  currentRaView = null;
  currentRaDisasterKey = null;
  clearRaSelections();
  exitRaExplainMode();
  raHideTip();
  document.body.classList.remove("ra-needs-action");
  if (raPanelEl) {
    raPanelEl.classList.remove("ra-disaster-focus");
  }
  [
    raEpochLabel,
    raPhaseLabel,
    raTurnLabel,
    raBagLabel,
    raCenterDiskLabel,
    raTrackCountLabel,
    raAuctionCountLabel,
    raTrackMeta,
    raAuctionMeta,
    raPlayersMeta,
    raReadyState,
  ].forEach((el) => {
    if (el) {
      el.textContent = "-";
    }
  });
  [
    raTrackEl,
    raAuctionTrackEl,
    raAuctionOrder,
    raBidButtons,
    raDisasterInfo,
    raDisasterChoices,
    raPlayersEl,
    raEpochNoticeList,
  ].forEach((el) => {
    if (el) {
      el.innerHTML = "";
    }
  });
  [raAuctionBox, raDisasterBox, raEpochNotice, raGodBar].forEach((el) => {
    if (el) {
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
    }
  });
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
    raHideTip();
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
  return RA_EXPLANATIONS[key] || null;
}

function updateRaExplainModeClasses(enabled) {
  document.querySelectorAll("[data-ra-explain]").forEach((el) => {
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
  if (raExplainMode) {
    raHideTip();
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

function showRaExplanation(key) {
  const explanation = raExplanationForKey(key);
  if (!explanation || !raExplainModal || !raExplainContent) {
    return;
  }
  raExplainContent.innerHTML =
    '<div class="rules-block"><h4>' + explanation.name + "</h4><p>" + explanation.description + "</p></div>";
  setModalVisible(raExplainModal, true);
}

function findRaExplainTargetAtPoint(x, y) {
  const targets = document.querySelectorAll("#raPanel [data-ra-explain]");
  for (const target of targets) {
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return target.dataset.raExplain;
    }
  }
  return null;
}

function raMakeTile(tile, options) {
  const opts = options || {};
  const group = raTileClassToken(tile && tile.group);
  const kind = raTileClassToken(tile && tile.kind);
  const meta = raTileMeta(tile);
  const groupLabel = RA_GROUP_LABELS[group] || "Tile";
  const tip = meta[1] + " (" + meta[0] + ") · " + groupLabel;
  const chip = document.createElement(opts.clickable ? "button" : "span");
  chip.className = "ra-tile ra-tile-" + group + " ra-kind-" + kind;
  chip.dataset.raTileGroup = group;
  chip.dataset.raTileKind = kind;

  const glyph = document.createElement("span");
  glyph.className = "ra-tile-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = meta[0];

  const name = document.createElement("span");
  name.className = "ra-tile-name";
  name.textContent = meta[1];

  chip.append(glyph, name);
  if (opts.badge) {
    const badge = document.createElement("span");
    badge.className = "ra-tile-badge";
    badge.textContent = opts.badge;
    chip.appendChild(badge);
  }
  if (opts.selected) {
    chip.classList.add("selected");
  }
  if (opts.recommended) {
    chip.classList.add("recommended");
  }
  if (opts.locked) {
    chip.classList.add("choice-locked");
  }

  if (opts.clickable) {
    chip.type = "button";
    chip.title = tip;
    chip.setAttribute("aria-label", tip);
    chip.setAttribute("aria-pressed", String(Boolean(opts.selected)));
    if (opts.explainKey) {
      chip.dataset.raExplain = opts.explainKey;
      chip.classList.toggle("has-explanation", raExplainMode);
    }
    raBindTap(chip, opts.onClick);
  } else {
    chip.dataset.raTip = tip;
    chip.setAttribute("role", "img");
    chip.setAttribute("aria-label", tip);
  }
  return chip;
}

function raMakeCountChip(tile, count, discard) {
  const meta = raTileMeta(tile);
  const group = raTileClassToken(tile && tile.group);
  const groupLabel = RA_GROUP_LABELS[group] || "Tile";
  const groupTip = RA_GROUP_TIPS[group] || "";
  const chip = document.createElement("span");
  chip.className = "ra-count-chip ra-chip-" + group + (discard ? " is-discard" : "");
  chip.dataset.raTip = meta[1] + " (" + meta[0] + ") x" + count + " · " + groupLabel + ". " + groupTip;
  chip.setAttribute("role", "img");
  chip.setAttribute("aria-label", meta[1] + " x" + count);
  const glyph = document.createElement("span");
  glyph.className = "ra-count-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = meta[0];
  const amount = document.createElement("span");
  amount.className = "ra-count-value";
  amount.textContent = "x" + count;
  chip.append(glyph, amount);
  return chip;
}

function raMakeScoreChip(item) {
  const meta = RA_SCORE_META[item.type] || ["•", item.type, ""];
  const points = Number(item.points || 0);
  const signed = (points >= 0 ? "+" : "") + points;
  const chip = document.createElement("span");
  chip.className = "ra-score-chip";
  chip.classList.toggle("negative", points < 0);
  chip.dataset.raTip = meta[1] + " (" + meta[0] + ") " + signed + ". " + meta[2];
  chip.setAttribute("role", "img");
  chip.setAttribute("aria-label", meta[1] + " " + signed);
  const glyph = document.createElement("span");
  glyph.className = "ra-score-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = meta[0];
  const value = document.createElement("span");
  value.className = "ra-score-value";
  value.textContent = signed;
  chip.append(glyph, value);
  return chip;
}

function raMakeDiskChip(disk, interactive) {
  const chip = document.createElement(interactive ? "button" : "span");
  chip.className = "ra-disk-chip" + (disk.ready ? "" : " spent");
  chip.textContent = "☀️" + disk.value;
  if (interactive) {
    chip.type = "button";
    chip.title = "Bid sun disk " + disk.value;
    chip.setAttribute("aria-label", "Bid sun disk " + disk.value);
  } else {
    chip.dataset.raTip = disk.ready
      ? "Sun disk (☀️) " + disk.value + " · ready. Bid it to win an auction; its value also counts after epoch 3."
      : "Sun disk (☀️) " + disk.value + " · spent this epoch. It flips back at the next epoch.";
    chip.setAttribute("role", "img");
    chip.setAttribute("aria-label", "Sun disk " + disk.value + (disk.ready ? " ready" : " spent"));
  }
  return chip;
}

function renderRaStatus(view) {
  if (raEpochLabel) {
    raEpochLabel.textContent = view.epoch === undefined || view.epoch === null ? "-" : view.epoch;
  }
  if (raPhaseLabel) {
    raPhaseLabel.textContent = RA_PHASE_LABELS[view.phase] || view.phase || "-";
  }
  if (raTurnLabel) {
    raTurnLabel.textContent = raPlayerName(view, view.current_turn);
  }
  if (raBagLabel) {
    raBagLabel.textContent = view.bag_count === undefined || view.bag_count === null ? "-" : view.bag_count;
  }
  if (raCenterDiskLabel) {
    raCenterDiskLabel.textContent = view.center_disk === undefined || view.center_disk === null ? "-" : view.center_disk;
  }
  if (raTrackCountLabel) {
    raTrackCountLabel.textContent = (view.ra_track || []).length + "/" + (view.ra_limit || "-");
  }
  if (raAuctionCountLabel) {
    raAuctionCountLabel.textContent = (view.auction_track || []).length + "/" + (view.auction_limit || 8);
  }
  if (raPhasePill) {
    raPhasePill.classList.toggle("is-active", raNeedsAction(view));
  }
  if (raTurnNamePill) {
    raTurnNamePill.classList.toggle("is-you", view.current_turn === view.you);
    raTurnNamePill.classList.toggle("hidden", !view.current_turn);
  }
}

function renderRaTracks(view) {
  if (!raTrackEl || !raAuctionTrackEl) {
    return;
  }
  const raLimit = view.ra_limit || 0;
  const raFilled = (view.ra_track || []).length;
  raTrackEl.innerHTML = "";
  raTrackEl.style.setProperty("--ra-track-count", String(raLimit || 1));
  for (let idx = 0; idx < raLimit; idx += 1) {
    const slot = document.createElement("div");
    slot.className = "ra-slot";
    slot.classList.toggle("filled", idx < raFilled);
    slot.classList.toggle("finish", idx === raLimit - 1);
    const marker = document.createElement("span");
    marker.className = "ra-slot-marker";
    marker.textContent = idx < raFilled ? "☀️" : String(idx + 1);
    slot.appendChild(marker);
    if (idx === raLimit - 1) {
      const label = document.createElement("span");
      label.className = "ra-slot-label";
      label.textContent = "END";
      slot.appendChild(label);
    }
    raTrackEl.appendChild(slot);
  }
  if (raTrackMeta) {
    raTrackMeta.textContent = raFilled + "/" + raLimit + " · " + (raLimit - raFilled) + " left";
  }

  const auctionTiles = view.auction_track || [];
  const auctionLimit = view.auction_limit || 8;
  raAuctionTrackEl.innerHTML = "";
  raAuctionTrackEl.style.setProperty("--ra-track-count", String(auctionLimit));
  raAuctionTrackEl.classList.toggle("is-empty", auctionTiles.length === 0);
  if (!auctionTiles.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "ra-track-empty";
    placeholder.textContent = "Auction track empty · 0/" + auctionLimit + " tiles";
    raAuctionTrackEl.appendChild(placeholder);
  }
  for (let idx = 0; idx < auctionTiles.length; idx += 1) {
    const tile = auctionTiles[idx];
    const slot = document.createElement("div");
    slot.className = "ra-auction-slot";
    slot.classList.toggle("filled", Boolean(tile));
    if (tile) {
      const clickable = raLegal("play_god") && tile.kind !== "god";
      slot.appendChild(
        raMakeTile(tile, {
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
        })
      );
    } else {
      const empty = document.createElement("span");
      empty.className = "ra-empty-slot";
      empty.setAttribute("aria-hidden", "true");
      empty.textContent = idx === auctionLimit - 1 ? "FULL" : "";
      slot.appendChild(empty);
    }
    raAuctionTrackEl.appendChild(slot);
  }
  for (let idx = auctionTiles.length; idx < auctionLimit; idx += 1) {
    const slot = document.createElement("div");
    slot.className = "ra-auction-slot";
    const empty = document.createElement("span");
    empty.className = "ra-empty-slot";
    empty.setAttribute("aria-hidden", "true");
    empty.textContent = idx === auctionLimit - 1 ? "FULL" : "";
    slot.appendChild(empty);
    raAuctionTrackEl.appendChild(slot);
  }
  if (raAuctionMeta) {
    raAuctionMeta.textContent = auctionTiles.length + "/" + auctionLimit + " tiles";
  }
}

function renderRaGodBar(view) {
  if (!raGodBar || !raGodBarText) {
    return;
  }
  const you = raYourPlayer();
  const godCount = you ? (you.tiles || []).filter((tile) => tile.kind === "god").length : 0;
  const visible = raLegal("play_god") && godCount > 0;
  raGodBar.classList.toggle("hidden", !visible);
  raGodBar.setAttribute("aria-hidden", (!visible).toString());
  if (!visible) {
    return;
  }
  const picked = selectedRaAuctionTiles.size;
  const affordable = Math.min(picked, godCount);
  if (picked) {
    raGodBarText.textContent =
      "⚡ Take " + picked + (picked === 1 ? " tile" : " tiles") + " · spend " + affordable + " God (" + godCount + " ⚡ held)";
  } else {
    raGodBarText.textContent = "⚡ Tap auction tiles to take them · " + godCount + " God held";
  }
  raGodBar.classList.toggle("is-ready", picked > 0);
}

function renderRaAuction(view) {
  if (!raAuctionBox || !raBidButtons || !raAuctionOrder) {
    return;
  }
  const auction = view.auction;
  const visible = view.phase === "auction" && auction;
  raAuctionBox.classList.toggle("hidden", !visible);
  raAuctionBox.setAttribute("aria-hidden", (!visible).toString());
  raBidButtons.innerHTML = "";
  raAuctionOrder.innerHTML = "";
  if (!visible) {
    return;
  }
  const bids = auction.bids || {};
  const passed = auction.passed || [];
  const currentBid = Math.max(0, ...Object.values(bids).map((value) => Number(value) || 0));
  if (raAuctionTitle) {
    raAuctionTitle.textContent = auction.forced ? "Forced Auction ☀️" : "Voluntary Auction ☀️";
  }
  if (raAuctionBid) {
    raAuctionBid.textContent =
      raPlayerName(view, auction.initiator) + " invoked · high bid " + (currentBid || "none");
  }

  const order =
    auction.bid_order && auction.bid_order.length
      ? auction.bid_order
      : (view.players || []).map((player) => player.player_id);
  raAuctionOrder.dataset.raExplain = "bidOrder";
  raAuctionOrder.classList.toggle("has-explanation", raExplainMode);
  order.forEach((pid) => {
    const row = document.createElement("span");
    row.className = "ra-bid-seat";
    row.classList.toggle("is-you", pid === view.you);
    row.classList.toggle("is-current", pid === view.current_turn);
    const name = document.createElement("b");
    name.textContent = raPlayerName(view, pid);
    const state = document.createElement("span");
    state.className = "ra-bid-state";
    if (bids[pid] !== undefined) {
      state.textContent = "☀️" + bids[pid];
      row.classList.add("has-bid");
    } else if (passed.indexOf(pid) >= 0) {
      state.textContent = "passed";
      row.classList.add("has-passed");
    } else if (pid === view.current_turn) {
      state.textContent = "deciding";
    } else {
      state.textContent = "waiting";
    }
    row.append(name, state);
    raAuctionOrder.appendChild(row);
  });

  const you = raYourPlayer();
  const disks = you && Array.isArray(you.sun_disks) ? you.sun_disks : [];
  disks.forEach((disk) => {
    const allowed = raLegal("bid") && disk.ready && Number(disk.value) > currentBid;
    const button = raMakeDiskChip(disk, true);
    button.classList.add("ra-bid-disk");
    button.dataset.raExplain = "bidDisk";
    button.classList.toggle("has-explanation", raExplainMode);
    button.disabled = !allowed;
    button.classList.toggle("action-allowed", allowed);
    raBindTap(button, () => sendAction({ type: "bid", disk: Number(disk.value) }));
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
  raDisasterInfo.innerHTML = "";
  raDisasterChoices.innerHTML = "";
  if (!visible) {
    return;
  }
  const guide = raDisasterGuide(view);
  const you = raYourPlayer();
  if (!guide || !you) {
    raDisasterInfo.textContent = "Choose the exact number of matching discard targets.";
    return;
  }
  const tilesById = new Map((you.tiles || []).map((tile) => [tile.id, tile]));
  const status = raDisasterSelectionStatus(view);
  const disasterNames = (pending.disasters || [])
    .map((tile) => {
      const meta = raTileMeta(tile);
      return meta[1] + " (" + meta[0] + ")";
    })
    .join(" + ");
  if (raDisasterMeta) {
    raDisasterMeta.textContent = disasterNames + " · " + status.selected + "/" + status.required + " chosen";
  }

  const suggestedIds = (guide.recommended_tile_ids || []).filter((tileId) => tilesById.has(tileId));
  if (suggestedIds.length && suggestedIds.length === status.required) {
    const suggestionButton = document.createElement("button");
    suggestionButton.type = "button";
    suggestionButton.className = "ra-suggestion-btn";
    const suggestionSelected =
      selectedRaDisasterTiles.size === suggestedIds.length &&
      suggestedIds.every((tileId) => selectedRaDisasterTiles.has(tileId));
    suggestionButton.textContent = suggestionSelected ? "✓ Suggestion applied" : "✨ Use low-loss pick";
    suggestionButton.addEventListener("click", () => {
      selectedRaDisasterTiles.clear();
      suggestedIds.forEach((tileId) => selectedRaDisasterTiles.add(tileId));
      renderRaGameState({ view: currentRaView, events: [] });
    });
    raDisasterInfo.appendChild(suggestionButton);
  }

  (guide.groups || []).forEach((group, index) => {
    const groupStatus = status.groups[index] || { selected: 0, required: Number(group.required) || 0 };
    const targetLabel = group.target_label || RA_DISASTER_TARGET_LABELS[group.disaster] || "Affected";
    const choiceGroup = document.createElement("div");
    choiceGroup.className = "ra-disaster-choice-group";
    const choiceTitle = document.createElement("div");
    choiceTitle.className = "ra-disaster-choice-title";
    const disasterMeta = RA_TILE_META[group.disaster] || ["⚠️", group.disaster || "Disaster"];
    const titleText = document.createElement("span");
    titleText.textContent =
      disasterMeta[0] + " " + disasterMeta[1] + " → discard " + groupStatus.required + " " + targetLabel;
    const progress = document.createElement("span");
    progress.className = "ra-disaster-progress";
    progress.classList.toggle("complete", groupStatus.selected === groupStatus.required);
    progress.textContent = groupStatus.selected + "/" + groupStatus.required;
    choiceTitle.append(titleText, progress);
    const choiceList = document.createElement("div");
    choiceList.className = "ra-disaster-choice-list";
    const recommended = new Set(group.recommended_tile_ids || []);

    (group.eligible_tile_ids || []).forEach((tileId) => {
      const tile = tilesById.get(tileId);
      if (!tile) {
        return;
      }
      const selected = selectedRaDisasterTiles.has(tile.id);
      const locked = !selected && groupStatus.selected >= groupStatus.required;
      const suggested = recommended.has(tile.id);
      choiceList.appendChild(
        raMakeTile(tile, {
          clickable: !locked,
          explainKey: "disasterTile",
          selected,
          recommended: suggested,
          locked,
          badge: suggested ? "★" : "",
          onClick: () => {
            if (selectedRaDisasterTiles.has(tile.id)) {
              selectedRaDisasterTiles.delete(tile.id);
            } else {
              selectedRaDisasterTiles.add(tile.id);
            }
            renderRaGameState({ view: currentRaView, events: [] });
          },
        })
      );
    });
    choiceGroup.append(choiceTitle, choiceList);
    raDisasterChoices.appendChild(choiceGroup);
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
  const gameOver = view.phase === "game_over";
  if (raEpochNoticeTitle) {
    raEpochNoticeTitle.textContent = gameOver ? "Final Scoring" : "Epoch " + summary.epoch + " Scoring";
  }
  const reasonText = {
    ra_track_full: "Ra track filled",
    all_sun_disks_spent: "all sun disks spent",
    bag_empty: "bag empty",
  };
  let body = reasonText[summary.reason] || summary.reason || "scoring";
  if (gameOver && Array.isArray(view.winner) && view.winner.length) {
    body = "Winner: " + view.winner.map((pid) => raPlayerName(view, pid)).join(", ");
  }
  raEpochNoticeBody.textContent = body;

  (summary.rows || []).forEach((row) => {
    const line = document.createElement("div");
    line.className = "ra-score-row";
    line.classList.toggle("is-you", row.player_id === view.you);
    const name = document.createElement("span");
    name.className = "ra-score-name";
    name.textContent = raPlayerName(view, row.player_id);
    const delta = document.createElement("span");
    delta.className = "ra-score-delta";
    delta.classList.toggle("negative", Number(row.delta) < 0);
    delta.textContent = (row.delta >= 0 ? "+" : "") + row.delta;
    const total = document.createElement("span");
    total.className = "ra-score-total";
    total.textContent = "= " + row.score;
    const details = document.createElement("span");
    details.className = "ra-score-details";
    details.textContent = (row.details || []).join(" · ");
    line.append(name, delta, total, details);
    raEpochNoticeList.appendChild(line);
  });

  if (raReadyState) {
    if (gameOver) {
      raReadyState.textContent = "Game over";
    } else {
      const players = view.players || [];
      const ready = players.filter((player) => player.ready_for_next);
      const you = raYourPlayer();
      raReadyState.textContent =
        you && you.ready_for_next
          ? "You confirmed · " + ready.length + "/" + players.length + " ready"
          : "Waiting for you · " + ready.length + "/" + players.length + " ready";
    }
  }
}

function raRenderCollection(player, container) {
  const counts = new Map();
  (player.tiles || []).forEach((tile) => {
    if (!counts.has(tile.kind)) {
      counts.set(tile.kind, { tile, count: 0 });
    }
    counts.get(tile.kind).count += 1;
  });
  const keep = [];
  const discard = [];
  counts.forEach((entry) => {
    if (RA_EPOCH_DISCARD_KINDS.has(entry.tile.kind)) {
      discard.push(entry);
    } else {
      keep.push(entry);
    }
  });

  [
    { title: "Keep", list: keep, isDiscard: false },
    { title: "Epoch end", list: discard, isDiscard: true },
  ].forEach((group) => {
    if (!group.list.length) {
      return;
    }
    const row = document.createElement("div");
    row.className = "ra-collection-row" + (group.isDiscard ? " is-discard" : "");
    const label = document.createElement("span");
    label.className = "ra-collection-label";
    label.textContent = group.title;
    label.dataset.raTip = group.isDiscard
      ? "Scored at the epoch end, then removed from the game."
      : "Kept for the rest of the game.";
    const chips = document.createElement("span");
    chips.className = "ra-collection-chips";
    group.list.forEach((entry) => {
      chips.appendChild(raMakeCountChip(entry.tile, entry.count, group.isDiscard));
    });
    row.append(label, chips);
    container.appendChild(row);
  });

  if (!container.childNodes.length) {
    const empty = document.createElement("div");
    empty.className = "ra-collection-empty";
    empty.textContent = "No tiles yet";
    container.appendChild(empty);
  }
}

function renderRaPlayers(view) {
  if (!raPlayersEl) {
    return;
  }
  raPlayersEl.innerHTML = "";
  const players = view.players || [];
  if (raPlayersMeta) {
    raPlayersMeta.textContent = players.length + " players";
  }
  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "ra-player-card";
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const head = document.createElement("div");
    head.className = "ra-player-head";
    const name = document.createElement("span");
    name.className = "ra-player-name";
    name.textContent = player.name || player.player_id;
    if (player.player_id === view.you) {
      const youTag = document.createElement("span");
      youTag.className = "ra-you-tag";
      youTag.textContent = "YOU";
      name.appendChild(youTag);
    }
    const score = document.createElement("span");
    score.className = "ra-player-score";
    score.textContent = player.score + " VP";
    score.dataset.raTip = "Victory points banked from finished epochs.";
    head.append(name, score);

    const disks = document.createElement("div");
    disks.className = "ra-disk-row";
    disks.dataset.raExplain = "sunDisks";
    disks.classList.toggle("has-explanation", raExplainMode);
    (player.sun_disks || []).forEach((disk) => {
      disks.appendChild(raMakeDiskChip(disk, false));
    });

    const projected = player.projected_epoch_score || {
      total: 0,
      projected_total_score: player.score,
      details: [],
    };
    const scoreRow = document.createElement("div");
    scoreRow.className = "ra-projected-row";
    const total = Number(projected.total || 0);
    const summary = document.createElement("span");
    summary.className = "ra-projected-total";
    summary.classList.toggle("negative", total < 0);
    summary.textContent =
      (total >= 0 ? "+" : "") + total + " → " + (projected.projected_total_score === undefined ? player.score : projected.projected_total_score);
    summary.dataset.raTip = "Projected epoch score from the tiles held right now, and the total it would give.";
    const scoreChips = document.createElement("span");
    scoreChips.className = "ra-projected-chips";
    (Array.isArray(projected.details) ? projected.details : []).forEach((item) => {
      scoreChips.appendChild(raMakeScoreChip(item));
    });
    scoreRow.append(summary, scoreChips);

    const collection = document.createElement("div");
    collection.className = "ra-collection";
    collection.dataset.raExplain = "collection";
    collection.classList.toggle("has-explanation", raExplainMode);
    raRenderCollection(player, collection);

    card.append(head, disks, scoreRow, collection);
    raPlayersEl.appendChild(card);
  });
}

function updateRaButtons() {
  const view = currentRaView;
  const phase = view ? view.phase : null;
  [
    [raDrawBtn, "draw_tile"],
    [raInvokeBtn, "invoke_ra"],
    [raPassBtn, "pass"],
    [raNextRoundBtn, "next_round"],
  ].forEach(([button, actionType]) => {
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
  if (raGodCancelBtn) {
    raGodCancelBtn.disabled = selectedRaAuctionTiles.size === 0;
  }
  if (raResolveDisasterBtn) {
    const status = raDisasterSelectionStatus(view);
    const allowed = raLegal("resolve_disaster") && status.valid;
    raResolveDisasterBtn.disabled = !allowed;
    raResolveDisasterBtn.classList.toggle("action-allowed", allowed);
    raResolveDisasterBtn.textContent = status.required
      ? "Discard " + status.selected + " / " + status.required
      : "Resolve Disaster";
  }
  if (raActionBar) {
    const showActions = phase === "turn" && (raLegal("draw_tile") || raLegal("invoke_ra"));
    raActionBar.classList.toggle("hidden", !showActions);
  }
}

function renderRaGameState(data) {
  const view = data.view;
  currentRaView = view;
  raSyncDisasterSelection(view);
  if (raPanelEl) {
    const pending = view.pending_disaster;
    const disasterFocus = Boolean(view.phase === "disaster" && pending && pending.player_id === view.you);
    raPanelEl.classList.toggle("ra-disaster-focus", disasterFocus);
  }
  if (currentGameType !== "ra") {
    currentGameType = "ra";
    setGamePanelVisibility("ra");
  }
  document.body.classList.toggle("ra-needs-action", raNeedsAction(view));

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

  renderRaStatus(view);
  renderRaTracks(view);
  renderRaGodBar(view);
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
if (raGodCancelBtn) {
  raGodCancelBtn.addEventListener("click", () => {
    selectedRaAuctionTiles.clear();
    renderRaGameState({ view: currentRaView, events: [] });
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
  if (event.key !== "Escape" || currentGameType !== "ra") {
    return;
  }
  if (raExplainMode) {
    exitRaExplainMode();
  }
  if (!raTipEl.hidden) {
    raHideTip();
  } else if (currentRaView && (selectedRaAuctionTiles.size || selectedRaDisasterTiles.size)) {
    clearRaSelections();
    renderRaGameState({ view: currentRaView, events: [] });
  }
  if (raHelpModal && !raHelpModal.classList.contains("hidden")) {
    setModalVisible(raHelpModal, false);
  }
  if (raExplainModal && !raExplainModal.classList.contains("hidden")) {
    setModalVisible(raExplainModal, false);
  }
});

document.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch" || raExplainMode || currentGameType !== "ra") {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-ra-tip]") : null;
  if (target) {
    raShowTip(target.dataset.raTip, target, false);
  }
});

document.addEventListener("pointerout", (event) => {
  if (event.pointerType === "touch") {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-ra-tip]") : null;
  if (target) {
    raHideTip();
  }
});

document.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "touch" || raExplainMode || currentGameType !== "ra" || raPointerMoved) {
    return;
  }
  const target = event.target instanceof Element ? event.target.closest("[data-ra-tip]") : null;
  if (target) {
    raShowTip(target.dataset.raTip, target, true);
  }
});

// Scroll gestures must never be mistaken for a deliberate tap on a tile or disk.
document.addEventListener(
  "pointerdown",
  (event) => {
    raPointerStart = { x: event.clientX, y: event.clientY };
    raPointerMoved = false;
  },
  true
);

document.addEventListener(
  "pointermove",
  (event) => {
    if (!raPointerStart || raPointerMoved) {
      return;
    }
    if (Math.abs(event.clientX - raPointerStart.x) > 8 || Math.abs(event.clientY - raPointerStart.y) > 8) {
      raPointerMoved = true;
    }
  },
  true
);

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!raExplainMode) {
      return;
    }
    const button = event.target instanceof Element ? event.target.closest("button") : null;
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
      showRaExplanation(explainKey);
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

document.addEventListener(
  "click",
  (event) => {
    if (raSuppressNextClick) {
      event.preventDefault();
      event.stopPropagation();
      raSuppressNextClick = false;
      return;
    }
    if (raExplainMode) {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
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
    if (!currentRaView || currentGameType !== "ra" || !raPanelEl || !raPanelEl.contains(event.target)) {
      return;
    }
    const interactive =
      event.target instanceof Element
        ? event.target.closest("button, [data-ra-tip], .ra-tile, .ra-player-card, .ra-panel-box, .ra-track-block")
        : null;
    if (interactive) {
      return;
    }
    if (selectedRaAuctionTiles.size || selectedRaDisasterTiles.size) {
      clearRaSelections();
      renderRaGameState({ view: currentRaView, events: [] });
    }
  },
  true
);

window.clearRaState = clearRaState;
window.renderRaGameState = renderRaGameState;
window.showRaHeaderActions = showRaHeaderActions;
