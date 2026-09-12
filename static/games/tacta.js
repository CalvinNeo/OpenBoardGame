let currentTactaView = null;
let tactaSelectedDeckEnd = null;
let tactaSelectedFace = "front";
let tactaCandidateIndex = 0;
let tactaIsolatedIndex = 0;
let tactaExplainMode = false;
let tactaSuppressClick = false;
let tactaViewBox = null;
let tactaLastFitKey = null;
let tactaPanState = null;
let tactaDidPan = false;

const tactaConfigBox = document.getElementById("tactaConfigBox");
const tactaModeSelect = document.getElementById("tactaModeSelect");
const tactaSuitFieldset = document.getElementById("tactaSuitFieldset");
const tactaSuitToggles = Array.from(document.querySelectorAll(".tacta-suit-toggle"));
const tactaConfigHint = document.getElementById("tactaConfigHint");
const tactaHeaderActions = document.getElementById("tactaHeaderActions");
const tactaHelpBtn = document.getElementById("tactaHelpBtn");
const tactaExplainBtn = document.getElementById("tactaExplainBtn");
const tactaFitBtn = document.getElementById("tactaFitBtn");
const tactaHelpModal = document.getElementById("tactaHelpModal");
const tactaHelpCloseBtn = document.getElementById("tactaHelpCloseBtn");
const tactaHelpContent = document.getElementById("tactaHelpContent");
const tactaExplainModal = document.getElementById("tactaExplainModal");
const tactaExplainCloseBtn = document.getElementById("tactaExplainCloseBtn");
const tactaExplainContent = document.getElementById("tactaExplainContent");
const tactaModeLabel = document.getElementById("tactaModeLabel");
const tactaRoundLabel = document.getElementById("tactaRoundLabel");
const tactaPhaseLabel = document.getElementById("tactaPhaseLabel");
const tactaTurnLabel = document.getElementById("tactaTurnLabel");
const tactaNotice = document.getElementById("tactaNotice");
const tactaNoticeTitle = document.getElementById("tactaNoticeTitle");
const tactaNoticeBody = document.getElementById("tactaNoticeBody");
const tactaNextRoundBtn = document.getElementById("tactaNextRoundBtn");
const tactaSabotageChoices = document.getElementById("tactaSabotageChoices");
const tactaSabotageButtons = document.getElementById("tactaSabotageButtons");
const tactaPlayers = document.getElementById("tactaPlayers");
const tactaBoardSvg = document.getElementById("tactaBoardSvg");
const tactaDeckCountLabel = document.getElementById("tactaDeckCountLabel");
const tactaTopCardBtn = document.getElementById("tactaTopCardBtn");
const tactaBottomCardBtn = document.getElementById("tactaBottomCardBtn");
const tactaPlacementStatus = document.getElementById("tactaPlacementStatus");
const tactaPreviousBtn = document.getElementById("tactaPreviousBtn");
const tactaNextBtn = document.getElementById("tactaNextBtn");
const tactaFlipBtn = document.getElementById("tactaFlipBtn");
const tactaPlaceBtn = document.getElementById("tactaPlaceBtn");
const tactaCancelBtn = document.getElementById("tactaCancelBtn");

const TACTA_SVG_NS = "http://www.w3.org/2000/svg";
const TACTA_COLOR_VALUES = {
  blue: "#4da3ff",
  green: "#45d483",
  orange: "#ff9a3c",
  pink: "#ff70ad",
  purple: "#b68cff",
  red: "#ff5e62",
};
const TACTA_SUIT_SYMBOLS = { circle: "○", square: "□", triangle: "△", start: "✦" };
const TACTA_MODE_LABELS = {
  standard: "Standard",
  quick: "Quick Round",
  limited_space: "Limited Space",
  sabotage: "Sabotage",
};
const TACTA_BUTTON_EXPLANATIONS = {
  tactaFitBtn: "Fit the entire current card layout inside the board window.",
  tactaTopCardBtn: "Select the top card of your deck. You may only play one of the two outer cards.",
  tactaBottomCardBtn: "Select the bottom card of your deck. It is hidden when only one card remains.",
  tactaPreviousBtn: "Show the previous server-approved snap position for the selected card and face.",
  tactaNextBtn: "Show the next server-approved snap position for the selected card and face.",
  tactaFlipBtn: "Mirror the selected card to its other face, then show legal positions for that face.",
  tactaPlaceBtn: "Commit the translucent preview. A committed card cannot be moved again.",
  tactaCancelBtn: "Clear the selected card and preview. Clicking blank board space does the same thing.",
  tactaNextRoundBtn: "Confirm that you reviewed this round. Limited Space continues only after every player confirms.",
  tactaPassCircleBtn: "Pass all six Circle-suit cards from your color to the player on your left.",
  tactaPassSquareBtn: "Pass all six Square-suit cards from your color to the player on your left.",
  tactaPassTriangleBtn: "Pass all six Triangle-suit cards from your color to the player on your left.",
};

const TACTA_HELP_HTML = `
  <h3>Goal</h3>
  <p>Finish with the most visible dots in your assigned color. A covered connector loses all of its dots; dots on the newly placed card remain visible.</p>
  <h3>Your turn</h3>
  <ol>
    <li>Choose only the top or bottom card of your shuffled deck.</li>
    <li>Use either mirrored face.</li>
    <li>Cover one exposed triangle, square, or rectangle with an identical outline. Dots are scoring markers only: a dotted shape may cover a blank one, and vice versa.</li>
    <li>The new card may overlap only the one target card. Touching a second card along an edge is allowed, but positive-area overlap is not.</li>
  </ol>
  <p>If neither outer card has any connected placement, isolated slots appear around the layout. Only then may you start a separate group.</p>
  <h3>Scoring</h3>
  <p>Each uncovered dot is one point for the card's printed color, even when another player controls that card in Sabotage. Ties share the win.</p>
  <h3>Modes</h3>
  <ul>
    <li><strong>Standard:</strong> all 18 cards per player.</li>
    <li><strong>Quick Round:</strong> one or two selected suits, six cards per suit.</li>
    <li><strong>Limited Space:</strong> three six-card rounds, one suit per round in the displayed seeded order. Everyone clicks Next Round before the board clears.</li>
    <li><strong>Sabotage:</strong> two suits. Secretly choose one full suit to pass left; points always stay with the printed color.</li>
  </ul>
  <p class="hint">This implementation uses an original, mechanically compatible geometry set rather than scans of commercial cards.</p>
`;

function updateTactaConfigControls() {
  const mode = tactaModeSelect ? tactaModeSelect.value || "standard" : "standard";
  const needsSuits = mode === "quick" || mode === "sabotage";
  if (tactaSuitFieldset) {
    tactaSuitFieldset.classList.toggle("hidden", !needsSuits);
  }
  if (!tactaConfigHint) {
    return;
  }
  const selected = tactaSuitToggles.filter((toggle) => toggle.checked).length;
  if (mode === "quick") {
    tactaConfigHint.textContent = `Choose 1 or 2 suits · ${selected * 6} cards per player.`;
  } else if (mode === "sabotage") {
    tactaConfigHint.textContent = "Choose exactly 2 suits · each player secretly passes one full suit left.";
  } else if (mode === "limited_space") {
    tactaConfigHint.textContent = "Three rounds · one seeded suit per round · 6 cards each.";
  } else {
    tactaConfigHint.textContent = "Each player uses all 18 cards.";
  }
}

function updateTactaConfigRow() {
  const visible = !!(currentRoomState && currentGameType === "tacta" && currentRoomState.status === "lobby");
  if (tactaConfigBox) {
    tactaConfigBox.classList.toggle("hidden", !visible);
    tactaConfigBox.setAttribute("aria-hidden", (!visible).toString());
  }
  updateTactaConfigControls();
}

function getTactaRoomConfig() {
  const mode = tactaModeSelect ? tactaModeSelect.value || "standard" : "standard";
  const config = { mode };
  if (mode === "quick" || mode === "sabotage") {
    const activeSuits = tactaSuitToggles.filter((toggle) => toggle.checked).map((toggle) => toggle.value);
    const validCount = mode === "quick" ? activeSuits.length === 1 || activeSuits.length === 2 : activeSuits.length === 2;
    if (!validCount) {
      log(mode === "quick" ? "TACTA Quick Round needs 1 or 2 suits" : "TACTA Sabotage needs exactly 2 suits");
      return null;
    }
    config.active_suits = activeSuits;
  }
  return config;
}

function openTactaModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeTactaModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function showTactaHeaderActions(show) {
  if (tactaHeaderActions) {
    tactaHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitTactaExplainMode();
    closeTactaModal(tactaHelpModal);
    closeTactaModal(tactaExplainModal);
  }
}

function enterTactaExplainMode() {
  tactaExplainMode = true;
  Object.keys(TACTA_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.add("has-explanation");
    }
  });
}

function exitTactaExplainMode() {
  tactaExplainMode = false;
  Object.keys(TACTA_BUTTON_EXPLANATIONS).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.remove("has-explanation");
    }
  });
}

function findTactaExplanationButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(TACTA_BUTTON_EXPLANATIONS)) {
    const button = document.getElementById(buttonId);
    if (!button) {
      continue;
    }
    const rect = button.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

function showTactaExplanation(buttonId) {
  if (tactaExplainContent) {
    tactaExplainContent.textContent = TACTA_BUTTON_EXPLANATIONS[buttonId] || "This control has no additional explanation.";
  }
  openTactaModal(tactaExplainModal);
}

function tactaActionAvailable(actionType) {
  return !!(
    currentTactaView &&
    Array.isArray(currentTactaView.legal_actions) &&
    currentTactaView.legal_actions.includes(actionType)
  );
}

function tactaPlayerName(view, playerId) {
  if (!playerId) {
    return "-";
  }
  const player = (view.players || []).find((item) => item.player_id === playerId);
  return player ? player.name || player.player_id : playerId;
}

function tactaTemplate(view, templateId) {
  return (view.templates || []).find((item) => item.template_id === templateId) || null;
}

function tactaOuterCard(view, deckEnd) {
  return (view.outer_cards || []).find((item) => item.deck_end === deckEnd) || null;
}

function tactaCreateSvgNode(tagName, attributes = {}) {
  const node = document.createElementNS(TACTA_SVG_NS, tagName);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function tactaFacePoint(view, point, face) {
  const width = Number((view.card_size || {}).width || 100);
  return face === "back" ? [width - Number(point[0]), Number(point[1])] : [Number(point[0]), Number(point[1])];
}

function tactaApplyMatrix(matrix, point) {
  const [a, b, c, d, tx, ty] = matrix.map(Number);
  return [a * point[0] + c * point[1] + tx, b * point[0] + d * point[1] + ty];
}

function tactaPointsAttribute(points) {
  return points.map((point) => `${Number(point[0]).toFixed(3)},${Number(point[1]).toFixed(3)}`).join(" ");
}

function tactaCardMatrixAttribute(matrix) {
  const values = (matrix || [1, 0, 0, 1, 0, 0]).map((value) => Number(value).toFixed(6));
  return `matrix(${values.join(" ")})`;
}

function tactaConnectorLocalGeometry(view, template, connector, face) {
  const slot = (view.slots || {})[connector.slot];
  if (!slot) {
    return null;
  }
  return {
    polygon: (slot.polygon || []).map((point) => tactaFacePoint(view, point, face)),
    dots: (slot.dot_positions || [])
      .slice(0, Number(connector.dots || 0))
      .map((point) => tactaFacePoint(view, point, face)),
  };
}

function appendTactaCard(parent, view, card, options = {}) {
  const template = tactaTemplate(view, card.template_id);
  if (!template) {
    return null;
  }
  const width = Number((view.card_size || {}).width || 100);
  const height = Number((view.card_size || {}).height || 150);
  const ownerColor = card.owner_color || "start";
  const color = TACTA_COLOR_VALUES[ownerColor] || "#dce5f2";
  const group = tactaCreateSvgNode("g", {
    class: `tacta-svg-card${options.ghost ? " is-ghost" : ""}${card.template_id === "start" ? " is-start" : ""}`,
    transform: tactaCardMatrixAttribute(card.matrix),
  });
  const background = tactaCreateSvgNode("rect", {
    class: "tacta-card-background",
    x: 0,
    y: 0,
    width,
    height,
    rx: 5,
    fill: card.template_id === "start" ? "#263241" : "#111a25",
    stroke: color,
    "stroke-width": options.ghost ? 3 : 2,
  });
  group.appendChild(background);
  (template.connectors || []).forEach((connector) => {
    const geometry = tactaConnectorLocalGeometry(view, template, connector, card.face || "front");
    if (!geometry) {
      return;
    }
    const covered = !!((card.covered_connectors || {})[connector.connector_id]);
    const polygon = tactaCreateSvgNode("polygon", {
      class: `tacta-connector${covered ? " is-covered" : ""}`,
      points: tactaPointsAttribute(geometry.polygon),
      fill: color,
      "fill-opacity": covered ? 0.12 : 0.25,
      stroke: color,
      "stroke-width": 1.5,
    });
    group.appendChild(polygon);
    if (!covered) {
      geometry.dots.forEach((point) => {
        group.appendChild(
          tactaCreateSvgNode("circle", {
            class: "tacta-score-dot",
            cx: point[0],
            cy: point[1],
            r: 3.2,
            fill: color,
          })
        );
      });
    }
  });
  const label = tactaCreateSvgNode("text", {
    class: "tacta-card-label",
    x: width / 2,
    y: height / 2 - 2,
    "text-anchor": "middle",
  });
  label.textContent = `${TACTA_SUIT_SYMBOLS[template.suit] || ""} ${template.value || ""}`.trim();
  group.appendChild(label);
  const owner = tactaCreateSvgNode("text", {
    class: "tacta-card-owner",
    x: width / 2,
    y: height / 2 + 16,
    "text-anchor": "middle",
    fill: color,
  });
  owner.textContent = card.template_id === "start" ? "START" : `${ownerColor.toUpperCase()}${card.face === "back" ? " ↔" : ""}`;
  group.appendChild(owner);
  parent.appendChild(group);
  return group;
}

function tactaWorldConnectorPolygon(view, cardId, connectorId) {
  const card = (view.placed_cards || []).find((item) => item.card_id === cardId);
  if (!card) {
    return [];
  }
  const template = tactaTemplate(view, card.template_id);
  const connector = template && (template.connectors || []).find((item) => item.connector_id === connectorId);
  const geometry = connector && tactaConnectorLocalGeometry(view, template, connector, card.face || "front");
  return geometry ? geometry.polygon.map((point) => tactaApplyMatrix(card.matrix, point)) : [];
}

function tactaSelectedCandidates() {
  if (!currentTactaView || !tactaSelectedDeckEnd) {
    return [];
  }
  return (currentTactaView.legal_placements || []).filter(
    (candidate) => candidate.deck_end === tactaSelectedDeckEnd && candidate.face === tactaSelectedFace
  );
}

function tactaCurrentPreview() {
  const candidates = tactaSelectedCandidates();
  if (!candidates.length) {
    return null;
  }
  tactaCandidateIndex = ((tactaCandidateIndex % candidates.length) + candidates.length) % candidates.length;
  return candidates[tactaCandidateIndex];
}

function tactaCardCorners(view, matrix) {
  const width = Number((view.card_size || {}).width || 100);
  const height = Number((view.card_size || {}).height || 150);
  return [[0, 0], [width, 0], [width, height], [0, height]].map((point) => tactaApplyMatrix(matrix, point));
}

function calculateTactaBoardBounds(view) {
  const points = [];
  (view.placed_cards || []).forEach((card) => points.push(...tactaCardCorners(view, card.matrix)));
  const preview = tactaCurrentPreview();
  if (preview) {
    points.push(...tactaCardCorners(view, preview.matrix));
  }
  if (!points.length) {
    return [-100, -125, 200, 250];
  }
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const padding = 85;
  return [minX - padding, minY - padding, Math.max(260, maxX - minX + padding * 2), Math.max(300, maxY - minY + padding * 2)];
}

function applyTactaViewBox() {
  if (tactaBoardSvg && tactaViewBox) {
    tactaBoardSvg.setAttribute("viewBox", tactaViewBox.map((value) => Number(value).toFixed(3)).join(" "));
  }
}

function fitTactaBoard() {
  if (!currentTactaView) {
    return;
  }
  tactaViewBox = calculateTactaBoardBounds(currentTactaView);
  applyTactaViewBox();
}

function renderTactaTargets(view, layer) {
  if (!tactaSelectedDeckEnd || !tactaActionAvailable("place_card")) {
    return;
  }
  const candidates = tactaSelectedCandidates();
  const preview = tactaCurrentPreview();
  const seen = new Set();
  candidates.forEach((candidate, index) => {
    const key = `${candidate.target_card_id}:${candidate.target_connector_id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const polygon = tactaWorldConnectorPolygon(view, candidate.target_card_id, candidate.target_connector_id);
    if (!polygon.length) {
      return;
    }
    const target = tactaCreateSvgNode("polygon", {
      class: `tacta-target${preview && key === `${preview.target_card_id}:${preview.target_connector_id}` ? " is-selected" : ""}`,
      points: tactaPointsAttribute(polygon),
      tabindex: 0,
      role: "button",
      "aria-label": `Use target connector ${key}`,
    });
    const chooseTarget = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (tactaExplainMode) {
        return;
      }
      tactaCandidateIndex = index;
      renderTactaBoard(view);
      updateTactaPlacementControls();
    };
    target.addEventListener("click", chooseTarget);
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        chooseTarget(event);
      }
    });
    layer.appendChild(target);
  });
}

function renderTactaIsolatedSlots(view, layer) {
  if (!tactaSelectedDeckEnd || !tactaActionAvailable("place_isolated")) {
    return;
  }
  const width = Number((view.card_size || {}).width || 100);
  const height = Number((view.card_size || {}).height || 150);
  (view.isolated_slots || []).forEach((slot, index) => {
    const matrix = slot.matrix || [1, 0, 0, 1, 0, 0];
    const outline = tactaCreateSvgNode("polygon", {
      class: `tacta-isolated-slot${index === tactaIsolatedIndex ? " is-selected" : ""}`,
      points: tactaPointsAttribute([[0, 0], [width, 0], [width, height], [0, height]].map((point) => tactaApplyMatrix(matrix, point))),
      tabindex: 0,
      role: "button",
      "aria-label": `Choose isolated slot ${index + 1}`,
    });
    const chooseSlot = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (tactaExplainMode) {
        return;
      }
      tactaIsolatedIndex = index;
      renderTactaBoard(view);
      updateTactaPlacementControls();
    };
    outline.addEventListener("click", chooseSlot);
    outline.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        chooseSlot(event);
      }
    });
    layer.appendChild(outline);
  });
}

function renderTactaBoard(view) {
  if (!tactaBoardSvg) {
    return;
  }
  tactaBoardSvg.innerHTML = "";
  const cardsLayer = tactaCreateSvgNode("g", { class: "tacta-cards-layer" });
  const targetLayer = tactaCreateSvgNode("g", { class: "tacta-target-layer" });
  const previewLayer = tactaCreateSvgNode("g", { class: "tacta-preview-layer" });
  (view.placed_cards || [])
    .slice()
    .sort((first, second) => Number(first.z_index || 0) - Number(second.z_index || 0))
    .forEach((card) => appendTactaCard(cardsLayer, view, card));
  renderTactaTargets(view, targetLayer);
  renderTactaIsolatedSlots(view, targetLayer);
  const preview = tactaCurrentPreview();
  const outer = tactaOuterCard(view, tactaSelectedDeckEnd);
  if (preview && outer) {
    appendTactaCard(previewLayer, view, { ...outer, face: preview.face, matrix: preview.matrix, covered_connectors: {} }, { ghost: true });
  } else if (outer && tactaActionAvailable("place_isolated") && (view.isolated_slots || []).length) {
    const slot = view.isolated_slots[Math.min(tactaIsolatedIndex, view.isolated_slots.length - 1)];
    appendTactaCard(previewLayer, view, { ...outer, face: tactaSelectedFace, matrix: slot.matrix, covered_connectors: {} }, { ghost: true });
  }
  tactaBoardSvg.append(cardsLayer, targetLayer, previewLayer);
  const fitKey = `${view.round}:${view.board_revision}`;
  if (!tactaViewBox || tactaLastFitKey !== fitKey) {
    tactaLastFitKey = fitKey;
    fitTactaBoard();
  } else {
    applyTactaViewBox();
  }
}

function selectTactaOuterCard(deckEnd) {
  if (tactaExplainMode || !currentTactaView) {
    return;
  }
  if (!tactaOuterCard(currentTactaView, deckEnd)) {
    return;
  }
  tactaSelectedDeckEnd = deckEnd;
  tactaSelectedFace = "front";
  tactaCandidateIndex = 0;
  tactaIsolatedIndex = 0;
  renderTactaOuterCards(currentTactaView);
  renderTactaBoard(currentTactaView);
  updateTactaPlacementControls();
}

function clearTactaPlacementSelection() {
  tactaSelectedDeckEnd = null;
  tactaSelectedFace = "front";
  tactaCandidateIndex = 0;
  tactaIsolatedIndex = 0;
  if (currentTactaView) {
    renderTactaOuterCards(currentTactaView);
    renderTactaBoard(currentTactaView);
    updateTactaPlacementControls();
  }
}

function renderTactaOuterCard(view, deckEnd, button, canChoose) {
  if (!button) {
    return;
  }
  const card = tactaOuterCard(view, deckEnd);
  const selected = tactaSelectedDeckEnd === deckEnd;
  const positionLabel = deckEnd === "top" ? "Top" : "Bottom";
  button.classList.toggle("hidden", !card);
  button.classList.toggle("is-selected", selected);
  button.setAttribute("aria-pressed", selected.toString());
  button.disabled = !card || !canChoose;
  button.replaceChildren();
  if (!card) {
    button.textContent = `${positionLabel} card`;
    return;
  }

  const color = TACTA_COLOR_VALUES[card.owner_color] || "#dce5f2";
  const face = selected ? tactaSelectedFace : "front";
  const cardWidth = Number((view.card_size || {}).width || 100);
  const cardHeight = Number((view.card_size || {}).height || 150);
  button.style.setProperty("--tacta-card-color", color);
  button.setAttribute(
    "aria-label",
    `${positionLabel} of deck: ${card.suit} ${card.value}, ${card.owner_color}, ${face} face${canChoose ? ". Select this card." : ". Available on your turn."}`
  );

  const position = document.createElement("span");
  position.className = "tacta-outer-card-position";
  position.textContent = `${positionLabel} of deck`;

  const cardSvg = tactaCreateSvgNode("svg", {
    class: "tacta-hand-card-svg",
    viewBox: `0 0 ${cardWidth} ${cardHeight}`,
    preserveAspectRatio: "xMidYMid meet",
    "aria-hidden": "true",
    focusable: "false",
  });
  appendTactaCard(
    cardSvg,
    view,
    { ...card, face, matrix: [1, 0, 0, 1, 0, 0], covered_connectors: {} }
  );

  const details = document.createElement("span");
  details.className = "tacta-outer-card-details";
  const identity = document.createElement("strong");
  identity.textContent = `${TACTA_SUIT_SYMBOLS[card.suit] || ""} ${card.value}`.trim();
  const score = document.createElement("span");
  score.className = "tacta-outer-card-score";
  score.textContent = `● ${card.value} pts`;
  score.setAttribute("aria-label", `${card.value} scoring dot${card.value === 1 ? "" : "s"} total`);
  const owner = document.createElement("span");
  owner.textContent = `${card.owner_color} card`;
  const faceLabel = document.createElement("span");
  faceLabel.className = "tacta-outer-card-face";
  faceLabel.textContent = `${face} face${selected ? " selected" : ""}`;
  details.append(identity, score, owner, faceLabel);
  button.append(position, cardSvg, details);
}

function renderTactaOuterCards(view) {
  const canChoose = tactaActionAvailable("place_card") || tactaActionAvailable("place_isolated");
  const viewer = (view.players || []).find((player) => player.player_id === view.you);
  if (tactaDeckCountLabel) {
    const count = Number(viewer ? viewer.deck_count : (view.outer_cards || []).length);
    tactaDeckCountLabel.textContent = `${count} card${count === 1 ? "" : "s"} remaining`;
  }
  [
    ["top", tactaTopCardBtn],
    ["bottom", tactaBottomCardBtn],
  ].forEach(([deckEnd, button]) => renderTactaOuterCard(view, deckEnd, button, canChoose));
}

function updateTactaPlacementControls() {
  const view = currentTactaView;
  const candidates = tactaSelectedCandidates();
  const preview = tactaCurrentPreview();
  const isolated = !!(view && tactaActionAvailable("place_isolated") && tactaSelectedDeckEnd && (view.isolated_slots || []).length);
  const optionCount = isolated ? (view.isolated_slots || []).length : candidates.length;
  if (tactaPlacementStatus) {
    if (!view || (!tactaActionAvailable("place_card") && !tactaActionAvailable("place_isolated"))) {
      tactaPlacementStatus.textContent = view && view.phase === "playing" ? "Wait for your turn." : "Placement is paused.";
    } else if (!tactaSelectedDeckEnd) {
      tactaPlacementStatus.textContent = "Choose your top or bottom card.";
    } else if (preview) {
      tactaPlacementStatus.textContent = `Preview ${tactaCandidateIndex + 1}/${candidates.length} · ${tactaSelectedFace} · covers ${preview.covered_dots || 0} dot(s). Click a highlighted target to jump there.`;
    } else if (isolated) {
      tactaPlacementStatus.textContent = `No connected move exists. Isolated slot ${tactaIsolatedIndex + 1}/${optionCount} is legal.`;
    } else {
      tactaPlacementStatus.textContent = `No legal position for this ${tactaSelectedFace} face. Flip it or choose the other end.`;
    }
  }
  if (tactaPreviousBtn) tactaPreviousBtn.disabled = optionCount <= 1;
  if (tactaNextBtn) tactaNextBtn.disabled = optionCount <= 1;
  if (tactaFlipBtn) tactaFlipBtn.disabled = !tactaSelectedDeckEnd || !(tactaActionAvailable("place_card") || tactaActionAvailable("place_isolated"));
  if (tactaPlaceBtn) tactaPlaceBtn.disabled = !(preview || isolated);
  if (tactaCancelBtn) tactaCancelBtn.disabled = !tactaSelectedDeckEnd;
}

function renderTactaPlayers(view) {
  if (!tactaPlayers) {
    return;
  }
  tactaPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("div");
    card.className = "tacta-player-card";
    card.style.setProperty("--tacta-player-color", TACTA_COLOR_VALUES[player.color] || "#dce5f2");
    if (player.player_id === view.you) card.classList.add("is-self");
    if (player.player_id === view.current_turn) card.classList.add("is-current");
    const name = document.createElement("strong");
    name.textContent = `${player.symbol || ""} ${player.name || player.player_id}`.trim();
    const details = document.createElement("span");
    const scoreText = view.mode === "limited_space" ? `Round ${player.score} · Total ${player.cumulative_score}` : `Score ${player.score}`;
    details.textContent = `${player.color} · ${scoreText} · Deck ${player.deck_count}`;
    if (view.phase === "sabotage_choose") {
      details.textContent += player.sabotage_ready ? " · Ready" : " · Choosing";
    }
    card.append(name, details);
    tactaPlayers.appendChild(card);
  });
}

function renderTactaSabotage(view) {
  if (!tactaSabotageChoices || !tactaSabotageButtons) {
    return;
  }
  const show = view.phase === "sabotage_choose";
  tactaSabotageChoices.classList.toggle("hidden", !show);
  tactaSabotageChoices.setAttribute("aria-hidden", (!show).toString());
  tactaSabotageButtons.innerHTML = "";
  if (!show) {
    return;
  }
  if (view.your_pass_suit) {
    const message = document.createElement("span");
    message.textContent = `Choice locked: ${TACTA_SUIT_SYMBOLS[view.your_pass_suit]} ${view.your_pass_suit}. Waiting for the others.`;
    tactaSabotageButtons.appendChild(message);
    return;
  }
  (view.active_suits || []).forEach((suit) => {
    const button = document.createElement("button");
    const capitalized = suit.charAt(0).toUpperCase() + suit.slice(1);
    button.id = `tactaPass${capitalized}Btn`;
    button.type = "button";
    button.textContent = `Pass ${TACTA_SUIT_SYMBOLS[suit]} ${capitalized}`;
    button.disabled = !tactaActionAvailable("choose_pass_suit");
    button.addEventListener("click", () => {
      if (tactaExplainMode || !tactaActionAvailable("choose_pass_suit")) {
        return;
      }
      if (window.confirm(`Pass every ${capitalized} card to the player on your left? This choice locks immediately.`)) {
        sendAction({ type: "choose_pass_suit", suit });
      }
    });
    tactaSabotageButtons.appendChild(button);
  });
  if (tactaExplainMode) {
    enterTactaExplainMode();
  }
}

function renderTactaNotice(view) {
  if (!tactaNotice || !tactaNoticeTitle || !tactaNoticeBody) {
    return;
  }
  const show = view.phase === "round_summary" || view.game_over;
  tactaNotice.classList.toggle("hidden", !show);
  tactaNotice.setAttribute("aria-hidden", (!show).toString());
  if (!show) {
    return;
  }
  if (view.game_over) {
    const winners = (view.winner || []).map((playerId) => tactaPlayerName(view, playerId)).join(", ");
    tactaNoticeTitle.textContent = "Game Over";
    tactaNoticeBody.textContent = `Winner${(view.winner || []).length === 1 ? "" : "s"}: ${winners || "-"}. ${
      (view.final_results || []).map((item) => `${tactaPlayerName(view, item.player_id)} ${item.score}`).join(" · ")
    }`;
  } else {
    const summary = view.last_round_summary || {};
    const readyNames = (view.next_ready || []).map((playerId) => tactaPlayerName(view, playerId));
    tactaNoticeTitle.textContent = `Round ${summary.round || view.round} complete`;
    tactaNoticeBody.textContent = `${Object.entries(summary.scores || {})
      .map(([playerId, score]) => `${tactaPlayerName(view, playerId)} ${score}`)
      .join(" · ")} · Ready ${readyNames.length}/${(view.players || []).length}`;
  }
  if (tactaNextRoundBtn) {
    tactaNextRoundBtn.classList.toggle("hidden", view.game_over);
    tactaNextRoundBtn.disabled = !tactaActionAvailable("next_round");
  }
}

function renderTactaGameState(data) {
  const view = data.view;
  const previousRevision = currentTactaView ? currentTactaView.board_revision : null;
  const previousRound = currentTactaView ? currentTactaView.round : null;
  currentTactaView = view;
  if (currentGameType !== "tacta") {
    currentGameType = "tacta";
    setGamePanelVisibility("tacta");
  }
  if (previousRevision !== null && (previousRevision !== view.board_revision || previousRound !== view.round)) {
    tactaSelectedDeckEnd = null;
    tactaSelectedFace = "front";
    tactaCandidateIndex = 0;
    tactaIsolatedIndex = 0;
  }
  if (tactaModeLabel) {
    const modeText = TACTA_MODE_LABELS[view.mode] || view.mode || "-";
    const suitOrder = view.mode === "limited_space"
      ? ` · ${view.suit_schedule.map((suit) => TACTA_SUIT_SYMBOLS[suit] || suit).join(" → ")}`
      : (view.mode === "quick" || view.mode === "sabotage")
        ? ` · ${view.active_suits.map((suit) => TACTA_SUIT_SYMBOLS[suit] || suit).join(" + ")}`
        : "";
    tactaModeLabel.textContent = `${modeText}${suitOrder}`;
  }
  if (tactaRoundLabel) {
    const total = view.mode === "limited_space" ? "/3" : "";
    tactaRoundLabel.textContent = `${view.round || 1}${total}`;
  }
  if (tactaPhaseLabel) tactaPhaseLabel.textContent = String(view.phase || "-").replaceAll("_", " ");
  if (tactaTurnLabel) tactaTurnLabel.textContent = tactaPlayerName(view, view.current_turn);
  renderTactaNotice(view);
  renderTactaSabotage(view);
  renderTactaPlayers(view);
  renderTactaOuterCards(view);
  renderTactaBoard(view);
  updateTactaPlacementControls();
  logGameEvents(data);
}

function clearTactaState() {
  currentTactaView = null;
  tactaSelectedDeckEnd = null;
  tactaSelectedFace = "front";
  tactaCandidateIndex = 0;
  tactaIsolatedIndex = 0;
  tactaViewBox = null;
  tactaLastFitKey = null;
  tactaPanState = null;
  exitTactaExplainMode();
  closeTactaModal(tactaHelpModal);
  closeTactaModal(tactaExplainModal);
  if (tactaBoardSvg) tactaBoardSvg.innerHTML = "";
  if (tactaPlayers) tactaPlayers.innerHTML = "";
  if (tactaSabotageButtons) tactaSabotageButtons.innerHTML = "";
}

function moveTactaPreview(direction) {
  if (!currentTactaView || !tactaSelectedDeckEnd) {
    return;
  }
  const candidates = tactaSelectedCandidates();
  const isolatedCount = tactaActionAvailable("place_isolated") ? (currentTactaView.isolated_slots || []).length : 0;
  if (candidates.length) {
    tactaCandidateIndex = (tactaCandidateIndex + direction + candidates.length) % candidates.length;
  } else if (isolatedCount) {
    tactaIsolatedIndex = (tactaIsolatedIndex + direction + isolatedCount) % isolatedCount;
  }
  renderTactaBoard(currentTactaView);
  updateTactaPlacementControls();
}

function submitTactaPlacement() {
  if (!currentTactaView || !tactaSelectedDeckEnd) {
    return;
  }
  const preview = tactaCurrentPreview();
  if (preview) {
    sendAction({
      type: "place_card",
      deck_end: preview.deck_end,
      face: preview.face,
      source_connector_id: preview.source_connector_id,
      target_card_id: preview.target_card_id,
      target_connector_id: preview.target_connector_id,
      symmetry_index: preview.symmetry_index,
      board_revision: currentTactaView.board_revision,
    });
    return;
  }
  if (tactaActionAvailable("place_isolated")) {
    const slots = currentTactaView.isolated_slots || [];
    const slot = slots[Math.min(tactaIsolatedIndex, slots.length - 1)];
    if (slot) {
      sendAction({
        type: "place_isolated",
        deck_end: tactaSelectedDeckEnd,
        face: tactaSelectedFace,
        isolated_slot_id: slot.isolated_slot_id,
        board_revision: currentTactaView.board_revision,
      });
    }
  }
}

if (tactaModeSelect) {
  tactaModeSelect.addEventListener("change", updateTactaConfigControls);
}
tactaSuitToggles.forEach((toggle) => toggle.addEventListener("change", updateTactaConfigControls));
if (tactaTopCardBtn) tactaTopCardBtn.addEventListener("click", () => selectTactaOuterCard("top"));
if (tactaBottomCardBtn) tactaBottomCardBtn.addEventListener("click", () => selectTactaOuterCard("bottom"));
if (tactaPreviousBtn) tactaPreviousBtn.addEventListener("click", () => moveTactaPreview(-1));
if (tactaNextBtn) tactaNextBtn.addEventListener("click", () => moveTactaPreview(1));
if (tactaFlipBtn) {
  tactaFlipBtn.addEventListener("click", () => {
    if (!tactaSelectedDeckEnd) return;
    tactaSelectedFace = tactaSelectedFace === "front" ? "back" : "front";
    tactaCandidateIndex = 0;
    renderTactaOuterCards(currentTactaView);
    renderTactaBoard(currentTactaView);
    updateTactaPlacementControls();
  });
}
if (tactaPlaceBtn) tactaPlaceBtn.addEventListener("click", submitTactaPlacement);
if (tactaCancelBtn) tactaCancelBtn.addEventListener("click", clearTactaPlacementSelection);
if (tactaFitBtn) tactaFitBtn.addEventListener("click", fitTactaBoard);
if (tactaNextRoundBtn) tactaNextRoundBtn.addEventListener("click", () => sendAction({ type: "next_round" }));

if (tactaHelpBtn) {
  tactaHelpBtn.addEventListener("click", () => {
    if (tactaHelpContent) tactaHelpContent.innerHTML = TACTA_HELP_HTML;
    openTactaModal(tactaHelpModal);
  });
}
if (tactaHelpCloseBtn) tactaHelpCloseBtn.addEventListener("click", () => closeTactaModal(tactaHelpModal));
if (tactaExplainBtn) {
  tactaExplainBtn.addEventListener("click", () => {
    if (tactaExplainMode) exitTactaExplainMode();
    else enterTactaExplainMode();
  });
}
if (tactaExplainCloseBtn) tactaExplainCloseBtn.addEventListener("click", () => closeTactaModal(tactaExplainModal));

if (tactaBoardSvg) {
  tactaBoardSvg.addEventListener("click", (event) => {
    if (tactaExplainMode || tactaDidPan) {
      tactaDidPan = false;
      return;
    }
    if (event.target === tactaBoardSvg || event.target.closest(".tacta-cards-layer")) {
      clearTactaPlacementSelection();
    }
  });
  tactaBoardSvg.addEventListener(
    "wheel",
    (event) => {
      if (!tactaViewBox) return;
      event.preventDefault();
      const rect = tactaBoardSvg.getBoundingClientRect();
      const cursorX = tactaViewBox[0] + ((event.clientX - rect.left) / rect.width) * tactaViewBox[2];
      const cursorY = tactaViewBox[1] + ((event.clientY - rect.top) / rect.height) * tactaViewBox[3];
      const factor = event.deltaY > 0 ? 1.12 : 0.89;
      const nextWidth = Math.min(8000, Math.max(180, tactaViewBox[2] * factor));
      const nextHeight = nextWidth * (tactaViewBox[3] / tactaViewBox[2]);
      const ratioX = (cursorX - tactaViewBox[0]) / tactaViewBox[2];
      const ratioY = (cursorY - tactaViewBox[1]) / tactaViewBox[3];
      tactaViewBox = [cursorX - nextWidth * ratioX, cursorY - nextHeight * ratioY, nextWidth, nextHeight];
      applyTactaViewBox();
    },
    { passive: false }
  );
  tactaBoardSvg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".tacta-target-layer")) return;
    tactaPanState = { x: event.clientX, y: event.clientY, viewBox: tactaViewBox ? [...tactaViewBox] : null };
    tactaDidPan = false;
    tactaBoardSvg.setPointerCapture(event.pointerId);
  });
  tactaBoardSvg.addEventListener("pointermove", (event) => {
    if (!tactaPanState || !tactaPanState.viewBox) return;
    const rect = tactaBoardSvg.getBoundingClientRect();
    const dx = ((event.clientX - tactaPanState.x) / rect.width) * tactaPanState.viewBox[2];
    const dy = ((event.clientY - tactaPanState.y) / rect.height) * tactaPanState.viewBox[3];
    if (Math.abs(event.clientX - tactaPanState.x) + Math.abs(event.clientY - tactaPanState.y) > 4) tactaDidPan = true;
    tactaViewBox = [tactaPanState.viewBox[0] - dx, tactaPanState.viewBox[1] - dy, tactaPanState.viewBox[2], tactaPanState.viewBox[3]];
    applyTactaViewBox();
  });
  tactaBoardSvg.addEventListener("pointerup", () => {
    tactaPanState = null;
  });
  tactaBoardSvg.addEventListener("pointercancel", () => {
    tactaPanState = null;
  });
}

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!tactaExplainMode) {
      return;
    }
    const buttonId = findTactaExplanationButtonAtPoint(event.clientX, event.clientY);
    if (!buttonId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    tactaSuppressClick = true;
    showTactaExplanation(buttonId);
    exitTactaExplainMode();
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    if (tactaSuppressClick) {
      tactaSuppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!tactaExplainMode) {
      return;
    }
    const button = event.target.closest("button");
    if (!button || !button.closest("#tactaPanel")) {
      return;
    }
    if (button === tactaHelpBtn || button === tactaExplainBtn || button === tactaHelpCloseBtn || button === tactaExplainCloseBtn) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  },
  true
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    exitTactaExplainMode();
    closeTactaModal(tactaHelpModal);
    closeTactaModal(tactaExplainModal);
    clearTactaPlacementSelection();
  }
});

window.updateTactaConfigRow = updateTactaConfigRow;
window.getTactaRoomConfig = getTactaRoomConfig;
window.showTactaHeaderActions = showTactaHeaderActions;
window.renderTactaGameState = renderTactaGameState;
window.clearTactaState = clearTactaState;
