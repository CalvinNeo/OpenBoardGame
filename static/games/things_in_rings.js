let currentThingsInRingsView = null;
let thingsInRingsSelectedHandIndex = null;
let thingsInRingsSelectedZoneId = null;
let thingsInRingsSelectedSeedIndex = null;
let thingsInRingsDecisionMemberships = [];
let thingsInRingsDecisionContextKey = null;
let thingsInRingsExplainMode = false;
let thingsInRingsExpandedZoneId = null;

const thingsInRingsPhaseLabel = document.getElementById("thingsInRingsPhase");
const thingsInRingsTurnLabel = document.getElementById("thingsInRingsTurn");
const thingsInRingsKnowerLabel = document.getElementById("thingsInRingsKnower");
const thingsInRingsDeckLabel = document.getElementById("thingsInRingsDeck");
const thingsInRingsRoleLabel = document.getElementById("thingsInRingsRole");
const thingsInRingsCluesLeftLabel = document.getElementById("thingsInRingsCluesLeft");
const thingsInRingsWinnerLabel = document.getElementById("thingsInRingsWinner");
const thingsInRingsStatusBody = document.getElementById("thingsInRingsStatusBody");
const thingsInRingsRingSummary = document.getElementById("thingsInRingsRingSummary");
const thingsInRingsPlayArea = document.getElementById("thingsInRingsPlayArea");
const thingsInRingsHand = document.getElementById("thingsInRingsHand");
const thingsInRingsPlaceBtn = document.getElementById("thingsInRingsPlaceBtn");
const thingsInRingsKnowerArea = document.getElementById("thingsInRingsKnowerArea");
const thingsInRingsKnowerTitle = document.getElementById("thingsInRingsKnowerTitle");
const thingsInRingsKnowerPrompt = document.getElementById("thingsInRingsKnowerPrompt");
const thingsInRingsKnowerCards = document.getElementById("thingsInRingsKnowerCards");
const thingsInRingsDecisionCard = document.getElementById("thingsInRingsDecisionCard");
const thingsInRingsDecisionRings = document.getElementById("thingsInRingsDecisionRings");
const thingsInRingsJudgeConfirmBtn = document.getElementById("thingsInRingsJudgeConfirmBtn");
const thingsInRingsBoard = document.getElementById("thingsInRingsBoard");
const thingsInRingsLastResolution = document.getElementById("thingsInRingsLastResolution");
const thingsInRingsLastResolutionBody = document.getElementById("thingsInRingsLastResolutionBody");
const thingsInRingsPlayers = document.getElementById("thingsInRingsPlayers");
const thingsInRingsPlayAgainBtn = document.getElementById("thingsInRingsPlayAgainBtn");

const thingsInRingsHelpBtn = document.getElementById("thingsInRingsHelpBtn");
const thingsInRingsExplainBtn = document.getElementById("thingsInRingsExplainBtn");
const thingsInRingsHelpModal = document.getElementById("thingsInRingsHelpModal");
const thingsInRingsHelpModalCloseBtn = document.getElementById("thingsInRingsHelpModalCloseBtn");
const thingsInRingsExplainModal = document.getElementById("thingsInRingsExplainModal");
const thingsInRingsExplainModalCloseBtn = document.getElementById("thingsInRingsExplainModalCloseBtn");
const thingsInRingsHelpContent = document.getElementById("thingsInRingsHelpContent");
const thingsInRingsExplainContent = document.getElementById("thingsInRingsExplainContent");
const thingsInRingsZoneModal = document.getElementById("thingsInRingsZoneModal");
const thingsInRingsZoneModalCloseBtn = document.getElementById("thingsInRingsZoneModalCloseBtn");
const thingsInRingsZoneModalTitle = document.getElementById("thingsInRingsZoneModalTitle");
const thingsInRingsZoneModalSubtitle = document.getElementById("thingsInRingsZoneModalSubtitle");
const thingsInRingsZoneModalList = document.getElementById("thingsInRingsZoneModalList");

const THINGS_IN_RINGS_RING_THEMES = {
  word: "word",
  attribute: "attribute",
  context: "context",
};

const THINGS_IN_RINGS_CIRCLE_LAYOUTS = {
  1: [
    { left: 27, top: 14, size: 46, labelLeft: 50, labelTop: 10 },
  ],
  2: [
    { left: 10, top: 16, size: 50, labelLeft: 26, labelTop: 11 },
    { left: 40, top: 16, size: 50, labelLeft: 74, labelTop: 11 },
  ],
  3: [
    { left: 14, top: 11, size: 44, labelLeft: 24, labelTop: 9 },
    { left: 42, top: 11, size: 44, labelLeft: 76, labelTop: 9 },
    { left: 28, top: 38, size: 44, labelLeft: 50, labelTop: 86 },
  ],
};

const THINGS_IN_RINGS_ZONE_LAYOUTS = {
  1: {
    "1": { x: 50, y: 44, w: 32, h: 24, previewLimit: 5 },
  },
  2: {
    "10": { x: 25, y: 42, w: 26, h: 20, previewLimit: 4 },
    "11": { x: 50, y: 42, w: 26, h: 22, previewLimit: 5 },
    "01": { x: 75, y: 42, w: 26, h: 20, previewLimit: 4 },
  },
  3: {
    "100": { x: 24, y: 32, w: 22, h: 16, previewLimit: 3 },
    "110": { x: 50, y: 24, w: 24, h: 16, previewLimit: 4 },
    "010": { x: 76, y: 32, w: 22, h: 16, previewLimit: 3 },
    "101": { x: 36, y: 52, w: 23, h: 16, previewLimit: 4 },
    "111": { x: 50, y: 41, w: 22, h: 17, previewLimit: 4 },
    "011": { x: 64, y: 52, w: 23, h: 16, previewLimit: 4 },
    "001": { x: 50, y: 69, w: 24, h: 16, previewLimit: 4 },
  },
};

const THINGS_IN_RINGS_OUTSIDE_PREVIEW_LIMIT = {
  1: 8,
  2: 8,
  3: 10,
};

const THINGS_IN_RINGS_HELP_TEXT = `
  <p><strong>Things in Rings</strong> is a hidden-rule deduction game. One player is the <strong>Knower</strong>; everyone else tries to place item cards into the correct ring zones.</p>
  <h3>Flow</h3>
  <ul>
    <li>The room chooses 1-3 ring types: <strong>Word</strong>, <strong>Attribute</strong>, and <strong>Context</strong>.</li>
    <li>The Knower gets one hidden rule for each ring, then places 3 public clue cards.</li>
    <li>On your turn, choose one hand card and one zone. If you are correct, keep going. If you are wrong, the card is moved to the correct zone, you draw 1 replacement card, and your turn ends.</li>
    <li><strong>Word</strong> rings are judged automatically by the system.</li>
    <li><strong>Attribute</strong> and <strong>Context</strong> rings are decided by the Knower.</li>
  </ul>
  <h3>Win</h3>
  <ul>
    <li>The first Finder who empties their hand with a correct placement wins immediately.</li>
  </ul>
`;

const THINGS_IN_RINGS_BUTTON_EXPLANATIONS = {
  thingsInRingsPlaceBtn: {
    name: "Place Selected Card",
    description: "Submit the selected hand card to the selected zone on the board.",
    cost: "Turn Action",
  },
  thingsInRingsJudgeConfirmBtn: {
    name: "Confirm Placement",
    description: "As the Knower, confirm clue placement or judge a played card for non-word rings.",
    cost: "Knower Decision",
  },
  thingsInRingsPlayAgainBtn: {
    name: "Play Again",
    description: "Start a new round and rotate the Knower to the next seat.",
    cost: "New Round",
  },
};

function showThingsInRingsHeaderActions(show) {
  const header = document.getElementById("thingsInRingsHeaderActions");
  if (header) {
    header.style.display = show ? "flex" : "none";
  }
}

function thingsInRingsActions() {
  return currentThingsInRingsView ? currentThingsInRingsView.legal_actions || [] : [];
}

function isThingsInRingsActionAvailable(action) {
  return thingsInRingsActions().includes(action);
}

function clearThingsInRingsState() {
  currentThingsInRingsView = null;
  thingsInRingsSelectedHandIndex = null;
  thingsInRingsSelectedZoneId = null;
  thingsInRingsSelectedSeedIndex = null;
  thingsInRingsDecisionMemberships = [];
  thingsInRingsDecisionContextKey = null;
  thingsInRingsExpandedZoneId = null;
  if (thingsInRingsPhaseLabel) thingsInRingsPhaseLabel.textContent = "-";
  if (thingsInRingsTurnLabel) thingsInRingsTurnLabel.textContent = "-";
  if (thingsInRingsKnowerLabel) thingsInRingsKnowerLabel.textContent = "-";
  if (thingsInRingsDeckLabel) thingsInRingsDeckLabel.textContent = "-";
  if (thingsInRingsRoleLabel) thingsInRingsRoleLabel.textContent = "-";
  if (thingsInRingsCluesLeftLabel) thingsInRingsCluesLeftLabel.textContent = "-";
  if (thingsInRingsWinnerLabel) thingsInRingsWinnerLabel.textContent = "-";
  if (thingsInRingsStatusBody) thingsInRingsStatusBody.textContent = "-";
  if (thingsInRingsRingSummary) thingsInRingsRingSummary.innerHTML = "";
  if (thingsInRingsHand) thingsInRingsHand.innerHTML = "";
  if (thingsInRingsKnowerCards) thingsInRingsKnowerCards.innerHTML = "";
  if (thingsInRingsDecisionCard) {
    thingsInRingsDecisionCard.textContent = "";
    thingsInRingsDecisionCard.classList.add("hidden");
    thingsInRingsDecisionCard.setAttribute("aria-hidden", "true");
  }
  if (thingsInRingsDecisionRings) thingsInRingsDecisionRings.innerHTML = "";
  if (thingsInRingsBoard) thingsInRingsBoard.innerHTML = "";
  if (thingsInRingsPlayers) thingsInRingsPlayers.innerHTML = "";
  if (thingsInRingsLastResolutionBody) thingsInRingsLastResolutionBody.textContent = "-";
  if (thingsInRingsLastResolution) {
    thingsInRingsLastResolution.classList.add("hidden");
    thingsInRingsLastResolution.setAttribute("aria-hidden", "true");
  }
  if (thingsInRingsPlayArea) thingsInRingsPlayArea.classList.remove("hidden");
  if (thingsInRingsKnowerArea) {
    thingsInRingsKnowerArea.classList.add("hidden");
    thingsInRingsKnowerArea.setAttribute("aria-hidden", "true");
  }
  if (thingsInRingsPlaceBtn) thingsInRingsPlaceBtn.disabled = true;
  if (thingsInRingsJudgeConfirmBtn) thingsInRingsJudgeConfirmBtn.disabled = true;
  if (thingsInRingsPlayAgainBtn) thingsInRingsPlayAgainBtn.disabled = true;
  if (thingsInRingsHelpModal) setModalVisible(thingsInRingsHelpModal, false);
  if (thingsInRingsExplainModal) setModalVisible(thingsInRingsExplainModal, false);
  if (thingsInRingsZoneModal) setModalVisible(thingsInRingsZoneModal, false);
  exitThingsInRingsExplainMode();
}

function getThingsInRingsPhaseLabel(phase) {
  if (phase === "seed_clues") return "Seed Clues";
  if (phase === "play") return "Finder Turn";
  if (phase === "judge") return "Knower Judge";
  if (phase === "game_over") return "Game Over";
  return phase || "-";
}

function getThingsInRingsRoleLabel(role) {
  if (role === "knower") return "Knower";
  if (role === "finder") return "Finder";
  return "-";
}

function renderThingsInRingsStatus(view) {
  if (!thingsInRingsStatusBody) {
    return;
  }
  if (view.game_over) {
    if (view.winner_name) {
      thingsInRingsStatusBody.textContent = `${view.winner_name} emptied their hand and won the round.`;
    } else {
      thingsInRingsStatusBody.textContent = "The round ended with no active Finders left.";
    }
    return;
  }
  if (view.phase === "seed_clues") {
    thingsInRingsStatusBody.textContent =
      view.your_role === "knower"
        ? "Choose three clue cards. Word rings are locked automatically; decide the other rings yourself."
        : "Waiting for the Knower to seed the opening clues.";
    return;
  }
  if (view.phase === "judge") {
    if (view.your_role === "knower" && view.pending_judgement) {
      thingsInRingsStatusBody.textContent = `Judge ${view.pending_judgement.thing_card.name} for the non-word rings.`;
    } else {
      const playerName = view.pending_judgement && view.pending_judgement.player_name ? view.pending_judgement.player_name : "another player";
      thingsInRingsStatusBody.textContent = `Waiting for the Knower to judge ${playerName}'s placement.`;
    }
    return;
  }
  if (view.phase === "play") {
    if (view.current_turn === view.you) {
      thingsInRingsStatusBody.textContent = "Pick one hand card, then tap a zone on the board and place it.";
    } else if (view.current_turn_name) {
      thingsInRingsStatusBody.textContent = `Waiting for ${view.current_turn_name} to place a card.`;
    } else {
      thingsInRingsStatusBody.textContent = "Waiting for the next Finder turn.";
    }
    return;
  }
  thingsInRingsStatusBody.textContent = "-";
}

function renderThingsInRingsRings(view) {
  if (!thingsInRingsRingSummary) {
    return;
  }
  thingsInRingsRingSummary.innerHTML = "";
  const rings = Array.isArray(view.rings) ? view.rings : [];
  rings.forEach((ring) => {
    const card = document.createElement("div");
    const theme = THINGS_IN_RINGS_RING_THEMES[ring.type] || "generic";
    card.className = `things-rings-rule-card ${theme}`;

    const top = document.createElement("div");
    top.className = "things-rings-rule-top";
    top.textContent = `${ring.label} Ring`;

    const body = document.createElement("div");
    body.className = "things-rings-rule-body";
    body.textContent = ring.rule_text || "Hidden Rule";

    const mode = document.createElement("div");
    mode.className = "things-rings-rule-mode";
    mode.textContent = ring.evaluation_mode === "auto" ? "Auto Judge" : "Knower Judge";

    card.appendChild(top);
    card.appendChild(body);
    card.appendChild(mode);
    thingsInRingsRingSummary.appendChild(card);
  });
}

function getThingsInRingsZoneCards(zone, view) {
  const cards = Array.isArray(zone.cards) ? [...zone.cards] : [];
  if (view.pending_judgement && view.pending_judgement.proposed_zone_id === zone.zone_id) {
    cards.push({
      thing_name: view.pending_judgement.thing_card ? view.pending_judgement.thing_card.name : "?",
      source: "pending",
    });
  }
  return cards;
}

function appendThingsInRingsCardChip(container, card) {
  const chip = document.createElement("div");
  chip.className = "things-rings-zone-card";
  if (card.source === "clue") {
    chip.classList.add("clue");
  }
  if (card.source === "pending") {
    chip.classList.add("pending");
  }
  chip.textContent = card.thing_name || "?";
  container.appendChild(chip);
}

function getThingsInRingsZoneLayout(ringCount, zoneId) {
  const layouts = THINGS_IN_RINGS_ZONE_LAYOUTS[ringCount] || {};
  return layouts[zoneId] || null;
}

function getThingsInRingsOutsideZoneId(ringCount) {
  return "0".repeat(Math.max(1, ringCount));
}

function openThingsInRingsZoneModal(zoneId) {
  thingsInRingsExpandedZoneId = zoneId;
  renderThingsInRingsZoneModal(currentThingsInRingsView);
}

function closeThingsInRingsZoneModal() {
  thingsInRingsExpandedZoneId = null;
  if (thingsInRingsZoneModal) {
    setModalVisible(thingsInRingsZoneModal, false);
  }
}

function renderThingsInRingsZoneModal(view) {
  if (!thingsInRingsZoneModal || !thingsInRingsZoneModalList || !thingsInRingsExpandedZoneId) {
    return;
  }
  const zones = Array.isArray(view && view.zones) ? view.zones : [];
  const zone = zones.find((entry) => entry.zone_id === thingsInRingsExpandedZoneId);
  if (!zone) {
    closeThingsInRingsZoneModal();
    return;
  }
  const cards = getThingsInRingsZoneCards(zone, view || {});
  if (thingsInRingsZoneModalTitle) {
    thingsInRingsZoneModalTitle.textContent = zone.title || zone.zone_id;
  }
  if (thingsInRingsZoneModalSubtitle) {
    const subtitle = zone.subtitle || "";
    thingsInRingsZoneModalSubtitle.textContent = subtitle ? `${subtitle} · ${cards.length} cards` : `${cards.length} cards`;
  }
  thingsInRingsZoneModalList.innerHTML = "";
  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "things-rings-zone-empty";
    empty.textContent = "No cards in this zone yet.";
    thingsInRingsZoneModalList.appendChild(empty);
  } else {
    cards.forEach((card) => {
      const row = document.createElement("div");
      row.className = "things-rings-zone-modal-item";
      appendThingsInRingsCardChip(row, card);
      if (card.source === "clue" || card.source === "pending") {
        const badge = document.createElement("span");
        badge.className = `things-rings-zone-modal-badge ${card.source}`;
        badge.textContent = card.source === "clue" ? "Clue" : "Pending";
        row.appendChild(badge);
      }
      thingsInRingsZoneModalList.appendChild(row);
    });
  }
  setModalVisible(thingsInRingsZoneModal, true);
}

function createThingsInRingsZoneRegion(zone, view, ringCount, layout, options = {}) {
  if (!options.outside) {
    const cards = getThingsInRingsZoneCards(zone, view);
    const previewLimit = options.previewLimit || layout.previewLimit || 4;
    const fragment = document.createDocumentFragment();
    const canPlace = isThingsInRingsActionAvailable("submit_play");

    const hitbox = document.createElement("button");
    hitbox.type = "button";
    hitbox.className = "things-rings-zone-hitbox";
    hitbox.style.setProperty("--zone-x", `${layout.x}%`);
    hitbox.style.setProperty("--zone-y", `${layout.y}%`);
    hitbox.style.setProperty("--zone-w", `${layout.w}%`);
    hitbox.style.setProperty("--zone-h", `${layout.h}%`);
    hitbox.setAttribute("aria-label", `${zone.title || zone.zone_id}${zone.subtitle ? `. ${zone.subtitle}` : ""}`);
    if (thingsInRingsSelectedZoneId === zone.zone_id && canPlace) {
      hitbox.classList.add("selected");
      hitbox.setAttribute("aria-pressed", "true");
    } else {
      hitbox.setAttribute("aria-pressed", "false");
    }
    if (canPlace) {
      hitbox.classList.add("clickable");
      hitbox.addEventListener("click", () => {
        thingsInRingsSelectedZoneId = thingsInRingsSelectedZoneId === zone.zone_id ? null : zone.zone_id;
        renderThingsInRingsBoard(view);
        updateThingsInRingsButtons(view);
      });
    } else {
      hitbox.disabled = true;
    }
    fragment.appendChild(hitbox);

    if (cards.length) {
      const cloud = document.createElement("div");
      cloud.className = "things-rings-zone-cloud";
      cloud.style.setProperty("--zone-x", `${layout.x}%`);
      cloud.style.setProperty("--zone-y", `${layout.y}%`);
      cloud.style.setProperty("--zone-w", `${layout.w}%`);

      const list = document.createElement("div");
      list.className = "things-rings-zone-cloud-cards";
      cards.slice(0, previewLimit).forEach((card) => appendThingsInRingsCardChip(list, card));
      cloud.appendChild(list);

      if (cards.length > previewLimit) {
        const footer = document.createElement("div");
        footer.className = "things-rings-zone-cloud-footer";
        const moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.className = "things-rings-zone-more-btn";
        moreBtn.textContent = `View all (${cards.length})`;
        moreBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openThingsInRingsZoneModal(zone.zone_id);
        });
        footer.appendChild(moreBtn);
        cloud.appendChild(footer);
      }
      fragment.appendChild(cloud);
    }
    return fragment;
  }

  const canPlace = isThingsInRingsActionAvailable("submit_play");
  const cards = getThingsInRingsZoneCards(zone, view);
  const previewLimit = options.previewLimit || layout.previewLimit || 4;
  const region = document.createElement("div");
  region.className = "things-rings-zone";
  region.style.setProperty("--zone-x", `${layout.x}%`);
  region.style.setProperty("--zone-y", `${layout.y}%`);
  region.style.setProperty("--zone-w", `${layout.w}%`);
  region.style.setProperty("--zone-h", `${layout.h}%`);
  if (options.outside) {
    region.classList.add("outside");
  }
  if (thingsInRingsSelectedZoneId === zone.zone_id && canPlace) {
    region.classList.add("selected");
  }
  if (canPlace) {
    region.classList.add("clickable");
    region.setAttribute("role", "button");
    region.setAttribute("tabindex", "0");
    region.setAttribute("aria-pressed", (thingsInRingsSelectedZoneId === zone.zone_id).toString());
    const selectZone = () => {
      thingsInRingsSelectedZoneId = thingsInRingsSelectedZoneId === zone.zone_id ? null : zone.zone_id;
      renderThingsInRingsBoard(view);
      updateThingsInRingsButtons(view);
    };
    region.addEventListener("click", selectZone);
    region.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectZone();
      }
    });
  }
  region.setAttribute("aria-label", `${zone.title || zone.zone_id}${zone.subtitle ? `. ${zone.subtitle}` : ""}`);

  if (options.outside) {
    const titleRow = document.createElement("div");
    titleRow.className = "things-rings-zone-title-row";

    const title = document.createElement("div");
    title.className = "things-rings-zone-title";
    title.textContent = zone.title || zone.zone_id;
    titleRow.appendChild(title);

    const count = document.createElement("span");
    count.className = "things-rings-zone-count";
    count.textContent = String(cards.length);
    titleRow.appendChild(count);
    region.appendChild(titleRow);

    const subtitle = document.createElement("div");
    subtitle.className = "things-rings-zone-subtitle";
    subtitle.textContent = zone.subtitle || "";
    region.appendChild(subtitle);
  }

  const list = document.createElement("div");
  list.className = "things-rings-zone-cards";
  const previewCards = cards.slice(0, previewLimit);
  previewCards.forEach((card) => appendThingsInRingsCardChip(list, card));
  if (!previewCards.length && options.outside) {
    const empty = document.createElement("div");
    empty.className = "things-rings-zone-empty";
    empty.textContent = options.outside ? "Nothing outside yet." : "Empty";
    list.appendChild(empty);
  }
  region.appendChild(list);

  const footer = document.createElement("div");
  footer.className = "things-rings-zone-footer";
  if (cards.length > previewLimit) {
    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "things-rings-zone-more-btn";
    moreBtn.textContent = `View all (${cards.length})`;
    moreBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openThingsInRingsZoneModal(zone.zone_id);
    });
    footer.appendChild(moreBtn);
  }
  region.appendChild(footer);
  return region;
}

function renderThingsInRingsHand(view) {
  if (!thingsInRingsHand) {
    return;
  }
  thingsInRingsHand.innerHTML = "";
  const hand = Array.isArray(view.your_hand) ? view.your_hand : [];
  const canPlace = isThingsInRingsActionAvailable("submit_play");
  if (!hand.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = view.your_role === "knower" ? "The Knower has no public hand." : "Your hand is empty.";
    thingsInRingsHand.appendChild(empty);
    return;
  }
  hand.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "things-rings-card";
    if (thingsInRingsSelectedHandIndex === index) {
      btn.classList.add("selected");
    }
    btn.disabled = !canPlace;
    btn.textContent = card.name || "?";
    btn.addEventListener("click", () => {
      thingsInRingsSelectedHandIndex = thingsInRingsSelectedHandIndex === index ? null : index;
      renderThingsInRingsHand(view);
      renderThingsInRingsBoard(view);
      updateThingsInRingsButtons(view);
    });
    thingsInRingsHand.appendChild(btn);
  });
}

function renderThingsInRingsBoard(view) {
  if (!thingsInRingsBoard) {
    return;
  }
  thingsInRingsBoard.innerHTML = "";
  const zones = Array.isArray(view.zones) ? view.zones : [];
  const rings = Array.isArray(view.rings) ? view.rings : [];
  const ringCount = rings.length;
  const outsideZoneId = getThingsInRingsOutsideZoneId(ringCount);
  const outsideZone = zones.find((zone) => zone.zone_id === outsideZoneId) || null;
  const shell = document.createElement("div");
  shell.className = `things-rings-board-shell ring-count-${ringCount}`;

  const stage = document.createElement("div");
  stage.className = `things-rings-board-stage ring-count-${ringCount}`;
  shell.appendChild(stage);

  const circleLayouts = THINGS_IN_RINGS_CIRCLE_LAYOUTS[ringCount] || [];
  rings.forEach((ring, index) => {
    const layout = circleLayouts[index];
    if (!layout) {
      return;
    }
    const circle = document.createElement("div");
    const theme = THINGS_IN_RINGS_RING_THEMES[ring.type] || "generic";
    circle.className = `things-rings-circle ${theme}`;
    circle.style.setProperty("--circle-left", `${layout.left}%`);
    circle.style.setProperty("--circle-top", `${layout.top}%`);
    circle.style.setProperty("--circle-size", `${layout.size}%`);
    stage.appendChild(circle);

    const label = document.createElement("div");
    label.className = `things-rings-circle-label ${theme}`;
    label.style.setProperty("--circle-label-left", `${layout.labelLeft}%`);
    label.style.setProperty("--circle-label-top", `${layout.labelTop}%`);
    label.textContent = ring.label || ring.type || "?";
    stage.appendChild(label);
  });

  const zoneLayer = document.createElement("div");
  zoneLayer.className = "things-rings-zone-layer";
  zones
    .filter((zone) => zone.zone_id !== outsideZoneId)
    .forEach((zone) => {
      const layout = getThingsInRingsZoneLayout(ringCount, zone.zone_id);
      if (!layout) {
        return;
      }
      zoneLayer.appendChild(createThingsInRingsZoneRegion(zone, view, ringCount, layout));
    });
  stage.appendChild(zoneLayer);

  if (outsideZone) {
    const outsideWrap = document.createElement("div");
    outsideWrap.className = "things-rings-outside-wrap";
    outsideWrap.appendChild(
      createThingsInRingsZoneRegion(outsideZone, view, ringCount, { x: 50, y: 50, w: 100, h: 100 }, {
        outside: true,
        previewLimit: THINGS_IN_RINGS_OUTSIDE_PREVIEW_LIMIT[ringCount] || 8,
      })
    );
    shell.appendChild(outsideWrap);
  }

  thingsInRingsBoard.appendChild(shell);

  if (thingsInRingsExpandedZoneId) {
    renderThingsInRingsZoneModal(view);
  }
}

function resetThingsInRingsDecision(autoMemberships) {
  const next = Array.isArray(autoMemberships) ? autoMemberships : [];
  thingsInRingsDecisionMemberships = next.map((value) => (typeof value === "boolean" ? value : null));
}

function getThingsInRingsDecisionContext(view) {
  if (view.phase === "judge" && view.pending_judgement) {
    return {
      key: `judge:${view.pending_judgement.thing_card ? view.pending_judgement.thing_card.id : "?"}:${view.pending_judgement.proposed_zone_id}`,
      autoMemberships: view.pending_judgement.auto_memberships || [],
      cardName: view.pending_judgement.thing_card ? view.pending_judgement.thing_card.name : "?",
      mode: "judge",
    };
  }
  if (view.phase === "seed_clues" && view.your_role === "knower") {
    const seedHand = Array.isArray(view.seed_hand) ? view.seed_hand : [];
    const selected = seedHand[thingsInRingsSelectedSeedIndex];
    if (selected) {
      return {
        key: `seed:${selected.id}`,
        autoMemberships: selected.auto_memberships || [],
        cardName: selected.name || "?",
        mode: "seed",
      };
    }
  }
  return null;
}

function renderThingsInRingsKnowerArea(view) {
  if (!thingsInRingsKnowerArea || !thingsInRingsKnowerCards || !thingsInRingsDecisionRings) {
    return;
  }
  const isKnower = view.your_role === "knower";
  const showArea = isKnower && (view.phase === "seed_clues" || view.phase === "judge");
  thingsInRingsKnowerArea.classList.toggle("hidden", !showArea);
  thingsInRingsKnowerArea.setAttribute("aria-hidden", (!showArea).toString());
  if (!showArea) {
    thingsInRingsKnowerCards.innerHTML = "";
    thingsInRingsDecisionRings.innerHTML = "";
    if (thingsInRingsDecisionCard) {
      thingsInRingsDecisionCard.textContent = "";
      thingsInRingsDecisionCard.classList.add("hidden");
      thingsInRingsDecisionCard.setAttribute("aria-hidden", "true");
    }
    return;
  }

  const isSeed = view.phase === "seed_clues";
  if (thingsInRingsKnowerTitle) {
    thingsInRingsKnowerTitle.textContent = isSeed ? "Clue Setup" : "Judge Placement";
  }
  if (thingsInRingsKnowerPrompt) {
    thingsInRingsKnowerPrompt.textContent = isSeed
      ? "Pick one clue card and decide the non-word rings."
      : "Confirm whether the played card fits each non-word ring.";
  }

  thingsInRingsKnowerCards.innerHTML = "";
  if (isSeed) {
    const seedHand = Array.isArray(view.seed_hand) ? view.seed_hand : [];
    if (thingsInRingsSelectedSeedIndex !== null && !seedHand[thingsInRingsSelectedSeedIndex]) {
      thingsInRingsSelectedSeedIndex = null;
    }
    seedHand.forEach((card, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "things-rings-card";
      if (thingsInRingsSelectedSeedIndex === index) {
        btn.classList.add("selected");
      }
      btn.textContent = card.name || "?";
      btn.addEventListener("click", () => {
        const same = thingsInRingsSelectedSeedIndex === index;
        thingsInRingsSelectedSeedIndex = same ? null : index;
        thingsInRingsDecisionContextKey = null;
        renderThingsInRingsKnowerArea(view);
      });
      thingsInRingsKnowerCards.appendChild(btn);
    });
  }

  const context = getThingsInRingsDecisionContext(view);
  if (!context) {
    thingsInRingsDecisionRings.innerHTML = "";
    if (thingsInRingsDecisionCard) {
      thingsInRingsDecisionCard.textContent = "";
      thingsInRingsDecisionCard.classList.add("hidden");
      thingsInRingsDecisionCard.setAttribute("aria-hidden", "true");
    }
    updateThingsInRingsButtons(view);
    return;
  }

  if (thingsInRingsDecisionContextKey !== context.key) {
    resetThingsInRingsDecision(context.autoMemberships);
    thingsInRingsDecisionContextKey = context.key;
  }

  if (thingsInRingsDecisionCard) {
    thingsInRingsDecisionCard.textContent = context.cardName;
    thingsInRingsDecisionCard.classList.remove("hidden");
    thingsInRingsDecisionCard.setAttribute("aria-hidden", "false");
  }

  thingsInRingsDecisionRings.innerHTML = "";
  const rings = Array.isArray(view.rings) ? view.rings : [];
  rings.forEach((ring, index) => {
    const row = document.createElement("div");
    row.className = "things-rings-decision-row";

    const header = document.createElement("div");
    header.className = "things-rings-decision-header";
    header.textContent = `${ring.label} Ring`;

    const rule = document.createElement("div");
    rule.className = "things-rings-decision-rule";
    rule.textContent = ring.rule_text || "Hidden Rule";

    const actions = document.createElement("div");
    actions.className = "things-rings-decision-actions";
    const autoValue = Array.isArray(context.autoMemberships) ? context.autoMemberships[index] : null;
    if (typeof autoValue === "boolean") {
      const chip = document.createElement("span");
      chip.className = `things-rings-auto-chip ${autoValue ? "yes" : "no"}`;
      chip.textContent = autoValue ? "Auto: Fits" : "Auto: Not Fit";
      actions.appendChild(chip);
      thingsInRingsDecisionMemberships[index] = autoValue;
    } else {
      const yesBtn = document.createElement("button");
      yesBtn.type = "button";
      yesBtn.className = "things-rings-decision-btn";
      yesBtn.textContent = "Fits";
      yesBtn.classList.toggle("selected", thingsInRingsDecisionMemberships[index] === true);
      yesBtn.addEventListener("click", () => {
        thingsInRingsDecisionMemberships[index] = true;
        renderThingsInRingsKnowerArea(view);
      });
      const noBtn = document.createElement("button");
      noBtn.type = "button";
      noBtn.className = "things-rings-decision-btn";
      noBtn.textContent = "Not Fit";
      noBtn.classList.toggle("selected", thingsInRingsDecisionMemberships[index] === false);
      noBtn.addEventListener("click", () => {
        thingsInRingsDecisionMemberships[index] = false;
        renderThingsInRingsKnowerArea(view);
      });
      actions.appendChild(yesBtn);
      actions.appendChild(noBtn);
    }

    row.appendChild(header);
    row.appendChild(rule);
    row.appendChild(actions);
    thingsInRingsDecisionRings.appendChild(row);
  });
  updateThingsInRingsButtons(view);
}

function renderThingsInRingsPlayers(view) {
  if (!thingsInRingsPlayers) {
    return;
  }
  thingsInRingsPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const tags = [player.role === "knower" ? "knower" : "finder", `${player.cards_left} cards`, `${player.wins} wins`];
    if (player.is_current) {
      tags.push("turn");
    }
    const suffix = tags.length ? ` (${tags.join(", ")})` : "";
    row.textContent = `${(player.seat ?? 0) + 1}. ${player.name || "Player"}${suffix}`;
    thingsInRingsPlayers.appendChild(row);
  });
}

function renderThingsInRingsLastResolution(view) {
  if (!thingsInRingsLastResolution || !thingsInRingsLastResolutionBody) {
    return;
  }
  const resolution = view.last_resolution;
  if (!resolution) {
    thingsInRingsLastResolution.classList.add("hidden");
    thingsInRingsLastResolution.setAttribute("aria-hidden", "true");
    thingsInRingsLastResolutionBody.textContent = "-";
    return;
  }
  const playerName = findPlayerName(view, resolution.player_id);
  const result = resolution.correct ? "Correct" : "Wrong";
  const replacement = resolution.drew_replacement ? " Drew 1 replacement card." : "";
  thingsInRingsLastResolutionBody.textContent = `${playerName} placed ${resolution.thing_name} into ${resolution.proposed_zone_id}. Actual zone: ${resolution.actual_zone_id}. ${result}.${replacement}`;
  thingsInRingsLastResolution.classList.remove("hidden");
  thingsInRingsLastResolution.setAttribute("aria-hidden", "false");
}

function updateThingsInRingsButtons(view) {
  if (thingsInRingsPlaceBtn) {
    thingsInRingsPlaceBtn.disabled = !(
      isThingsInRingsActionAvailable("submit_play") &&
      thingsInRingsSelectedHandIndex !== null &&
      typeof thingsInRingsSelectedZoneId === "string"
    );
  }
  if (thingsInRingsJudgeConfirmBtn) {
    const context = getThingsInRingsDecisionContext(view);
    const ready =
      context &&
      Array.isArray(thingsInRingsDecisionMemberships) &&
      thingsInRingsDecisionMemberships.length === (view.rings || []).length &&
      thingsInRingsDecisionMemberships.every((value) => typeof value === "boolean") &&
      (isThingsInRingsActionAvailable("submit_seed_clue") || isThingsInRingsActionAvailable("judge_play"));
    thingsInRingsJudgeConfirmBtn.disabled = !ready;
    thingsInRingsJudgeConfirmBtn.textContent = view.phase === "seed_clues" ? "Place Clue" : "Confirm Judgement";
  }
  if (thingsInRingsPlayAgainBtn) {
    thingsInRingsPlayAgainBtn.disabled = !isThingsInRingsActionAvailable("play_again");
  }
}

function submitThingsInRingsPlacement() {
  if (!currentThingsInRingsView || !isThingsInRingsActionAvailable("submit_play")) {
    return;
  }
  if (thingsInRingsSelectedHandIndex === null || typeof thingsInRingsSelectedZoneId !== "string") {
    return;
  }
  sendAction({
    type: "submit_play",
    hand_index: thingsInRingsSelectedHandIndex,
    zone_id: thingsInRingsSelectedZoneId,
  });
}

function submitThingsInRingsDecision() {
  if (!currentThingsInRingsView) {
    return;
  }
  const memberships = Array.isArray(thingsInRingsDecisionMemberships)
    ? thingsInRingsDecisionMemberships.map((value) => value === true)
    : [];
  if (memberships.length !== (currentThingsInRingsView.rings || []).length) {
    return;
  }
  if (currentThingsInRingsView.phase === "seed_clues" && isThingsInRingsActionAvailable("submit_seed_clue")) {
    if (thingsInRingsSelectedSeedIndex === null) {
      return;
    }
    sendAction({
      type: "submit_seed_clue",
      hand_index: thingsInRingsSelectedSeedIndex,
      memberships,
    });
    thingsInRingsSelectedSeedIndex = null;
    thingsInRingsDecisionContextKey = null;
    return;
  }
  if (currentThingsInRingsView.phase === "judge" && isThingsInRingsActionAvailable("judge_play")) {
    sendAction({ type: "judge_play", memberships });
    thingsInRingsDecisionContextKey = null;
  }
}

function renderThingsInRingsGameState(data) {
  if (!data || !data.view) {
    return;
  }
  if (currentGameType !== "things_in_rings") {
    currentGameType = "things_in_rings";
    setGamePanelVisibility("things_in_rings");
  }
  currentThingsInRingsView = data.view;
  const view = currentThingsInRingsView;

  if (thingsInRingsSelectedHandIndex !== null && !view.your_hand[thingsInRingsSelectedHandIndex]) {
    thingsInRingsSelectedHandIndex = null;
  }
  if (!isThingsInRingsActionAvailable("submit_play")) {
    thingsInRingsSelectedZoneId = null;
  }
  if (thingsInRingsPhaseLabel) thingsInRingsPhaseLabel.textContent = getThingsInRingsPhaseLabel(view.phase);
  if (thingsInRingsTurnLabel) {
    thingsInRingsTurnLabel.textContent = view.current_turn_name || "-";
  }
  if (thingsInRingsKnowerLabel) thingsInRingsKnowerLabel.textContent = view.knower_name || "-";
  if (thingsInRingsDeckLabel) thingsInRingsDeckLabel.textContent = view.deck_count ?? "-";
  if (thingsInRingsRoleLabel) thingsInRingsRoleLabel.textContent = getThingsInRingsRoleLabel(view.your_role);
  if (thingsInRingsCluesLeftLabel) {
    thingsInRingsCluesLeftLabel.textContent = view.phase === "seed_clues" ? view.seed_clues_remaining ?? "-" : "-";
  }
  if (thingsInRingsWinnerLabel) {
    thingsInRingsWinnerLabel.textContent = view.winner_name || (view.game_over ? "No Winner" : "-");
  }
  if (thingsInRingsPlayArea) {
    const showPlayArea = view.your_role === "finder";
    thingsInRingsPlayArea.classList.toggle("hidden", !showPlayArea);
  }

  renderThingsInRingsStatus(view);
  renderThingsInRingsRings(view);
  renderThingsInRingsHand(view);
  renderThingsInRingsKnowerArea(view);
  renderThingsInRingsBoard(view);
  renderThingsInRingsLastResolution(view);
  renderThingsInRingsPlayers(view);
  updateThingsInRingsButtons(view);
  logGameEvents(data);
}

if (thingsInRingsPlaceBtn) {
  thingsInRingsPlaceBtn.addEventListener("click", submitThingsInRingsPlacement);
}

if (thingsInRingsJudgeConfirmBtn) {
  thingsInRingsJudgeConfirmBtn.addEventListener("click", submitThingsInRingsDecision);
}

if (thingsInRingsPlayAgainBtn) {
  thingsInRingsPlayAgainBtn.addEventListener("click", () => {
    if (!isThingsInRingsActionAvailable("play_again")) {
      return;
    }
    sendAction({ type: "play_again" });
  });
}

if (thingsInRingsRingCountSelect) {
  thingsInRingsRingCountSelect.addEventListener("change", () => {
    updateThingsInRingsConfigRow();
  });
}

function showThingsInRingsHelpModal() {
  if (thingsInRingsHelpContent) {
    thingsInRingsHelpContent.innerHTML = THINGS_IN_RINGS_HELP_TEXT;
  }
  if (thingsInRingsHelpModal) {
    setModalVisible(thingsInRingsHelpModal, true);
  }
}

function closeThingsInRingsHelpModal() {
  if (thingsInRingsHelpModal) {
    setModalVisible(thingsInRingsHelpModal, false);
  }
}

function updateThingsInRingsExplainModeClasses(enabled) {
  Object.keys(THINGS_IN_RINGS_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.classList.toggle("has-explanation", enabled);
    }
  });
}

function findThingsInRingsButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(THINGS_IN_RINGS_BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function toggleThingsInRingsExplainMode() {
  thingsInRingsExplainMode = !thingsInRingsExplainMode;
  document.body.classList.toggle("things-rings-explain-mode", thingsInRingsExplainMode);
  updateThingsInRingsExplainModeClasses(thingsInRingsExplainMode);
  if (thingsInRingsExplainBtn) {
    thingsInRingsExplainBtn.classList.toggle("active", thingsInRingsExplainMode);
  }
}

function exitThingsInRingsExplainMode() {
  if (!thingsInRingsExplainMode) {
    return;
  }
  thingsInRingsExplainMode = false;
  document.body.classList.remove("things-rings-explain-mode");
  updateThingsInRingsExplainModeClasses(false);
  if (thingsInRingsExplainBtn) {
    thingsInRingsExplainBtn.classList.remove("active");
  }
}

function showThingsInRingsButtonExplanation(buttonId) {
  const explanation = THINGS_IN_RINGS_BUTTON_EXPLANATIONS[buttonId];
  if (!explanation || !thingsInRingsExplainContent || !thingsInRingsExplainModal) {
    return;
  }
  thingsInRingsExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
    <span class="explain-cost end">${explanation.cost}</span>
  `;
  setModalVisible(thingsInRingsExplainModal, true);
}

function closeThingsInRingsExplainModal() {
  if (thingsInRingsExplainModal) {
    setModalVisible(thingsInRingsExplainModal, false);
  }
}

if (thingsInRingsHelpBtn) {
  thingsInRingsHelpBtn.addEventListener("click", showThingsInRingsHelpModal);
}

if (thingsInRingsHelpModalCloseBtn) {
  thingsInRingsHelpModalCloseBtn.addEventListener("click", closeThingsInRingsHelpModal);
}

if (thingsInRingsExplainBtn) {
  thingsInRingsExplainBtn.addEventListener("click", toggleThingsInRingsExplainMode);
}

if (thingsInRingsExplainModalCloseBtn) {
  thingsInRingsExplainModalCloseBtn.addEventListener("click", closeThingsInRingsExplainModal);
}

if (thingsInRingsZoneModalCloseBtn) {
  thingsInRingsZoneModalCloseBtn.addEventListener("click", closeThingsInRingsZoneModal);
}

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!thingsInRingsExplainMode) return;
    const buttonId = findThingsInRingsButtonAtPoint(event.clientX, event.clientY);
    if (buttonId) {
      event.preventDefault();
      event.stopPropagation();
      showThingsInRingsButtonExplanation(buttonId);
      exitThingsInRingsExplainMode();
      return;
    }
    const button = event.target.closest("button");
    if (button === thingsInRingsExplainBtn || button === thingsInRingsHelpBtn) return;
    if (button === thingsInRingsHelpModalCloseBtn || button === thingsInRingsExplainModalCloseBtn) return;
    if (button) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    if (!thingsInRingsExplainMode) return;
    const button = event.target.closest("button");
    if (!button) return;
    if (button === thingsInRingsExplainBtn || button === thingsInRingsHelpBtn) return;
    if (button === thingsInRingsHelpModalCloseBtn || button === thingsInRingsExplainModalCloseBtn) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && thingsInRingsZoneModal && !thingsInRingsZoneModal.classList.contains("hidden")) {
    closeThingsInRingsZoneModal();
    return;
  }
  if (event.key === "Escape" && thingsInRingsExplainMode) {
    exitThingsInRingsExplainMode();
  }
});

window.renderThingsInRingsGameState = renderThingsInRingsGameState;
window.clearThingsInRingsState = clearThingsInRingsState;
window.showThingsInRingsHeaderActions = showThingsInRingsHeaderActions;
