let currentGizmosView = null;
let gizmosResearchOrder = [];
let gizmosExplainMode = false;

const gizmosPanel = document.getElementById("gizmosPanel");
const gizmosPhaseLabel = document.getElementById("gizmosPhase");
const gizmosTurnLabel = document.getElementById("gizmosTurn");
const gizmosBagCountLabel = document.getElementById("gizmosBagCount");
const gizmosFinalRoundLabel = document.getElementById("gizmosFinalRound");
const gizmosWinnerLabel = document.getElementById("gizmosWinner");
const gizmosPrompt = document.getElementById("gizmosPrompt");
const gizmosEnergyRow = document.getElementById("gizmosEnergyRow");
const gizmosDisplay = document.getElementById("gizmosDisplay");
const gizmosYou = document.getElementById("gizmosYou");
const gizmosResearchWrap = document.getElementById("gizmosResearchWrap");
const gizmosResearchCards = document.getElementById("gizmosResearchCards");
const gizmosResearchSkipBtn = document.getElementById("gizmosResearchSkipBtn");
const gizmosActions = document.getElementById("gizmosActions");
const gizmosPlayers = document.getElementById("gizmosPlayers");

const gizmosHeaderActions = document.getElementById("gizmosHeaderActions");
const gizmosHelpBtn = document.getElementById("gizmosHelpBtn");
const gizmosExplainBtn = document.getElementById("gizmosExplainBtn");
const gizmosHelpModal = document.getElementById("gizmosHelpModal");
const gizmosHelpModalCloseBtn = document.getElementById("gizmosHelpModalCloseBtn");
const gizmosHelpContent = document.getElementById("gizmosHelpContent");
const gizmosExplainModal = document.getElementById("gizmosExplainModal");
const gizmosExplainModalCloseBtn = document.getElementById("gizmosExplainModalCloseBtn");
const gizmosExplainContent = document.getElementById("gizmosExplainContent");

const GIZMOS_ENERGY_LABELS = {
  red: "🔴 Heat",
  yellow: "🟡 Electric",
  blue: "🔵 Atomic",
  black: "⚫ Battery",
  generic: "🌈 Any",
};

const GIZMOS_PANEL_LABELS = {
  file: "🗂️ File",
  pick: "🫳 Pick",
  build: "🛠️ Build",
  converter: "🔁 Converter",
  upgrade: "➕ Upgrade",
  generic: "✨ Generic",
};

const GIZMOS_LOCATION_LABELS = {
  display: "Display",
  archive: "Archive",
  research: "Research",
  active: "Active Gizmo",
  player: "Player Summary",
  lab: "Your Lab",
};

const GIZMOS_HELP_HTML = `
  <h3>Goal</h3>
  <p>Build the strongest machine chain. The game ends when someone builds a 4th Level 3 Gizmo or reaches 16 total Gizmos, then the round finishes and total points decide the winner.</p>

  <h3>Base Actions</h3>
  <ul>
    <li><strong>File</strong>: take one display card into your Archive.</li>
    <li><strong>Pick</strong>: take one visible energy from the row.</li>
    <li><strong>Build</strong>: build a Gizmo from display or Archive by paying energy.</li>
    <li><strong>Research</strong>: draw from one level deck, then File or Build one of those cards, or keep none.</li>
  </ul>

  <h3>Combos</h3>
  <p>Built Gizmos trigger after matching actions. Resolve them in the order the game offers during the chain. This implementation auto-computes build payments and converter usage for you.</p>

  <h3>Important Notes</h3>
  <ul>
    <li>Archive and stored energy are public in this digital implementation.</li>
    <li>Research return order matters: leftmost card in the Research area will go deepest to the bottom.</li>
    <li>This version prioritizes full gameplay flow. The card pool is a near-official implementation, not a scanned card-for-card reproduction.</li>
  </ul>
`;

function gizmosCan(view, action) {
  return Array.isArray(view && view.legal_actions) && view.legal_actions.includes(action);
}

function gizmosSelf(view) {
  if (!view || !Array.isArray(view.players)) return null;
  return view.players.find((player) => player.player_id === view.you) || null;
}

function gizmosFindPlayer(view, playerId) {
  if (!view || !Array.isArray(view.players)) return null;
  return view.players.find((player) => player.player_id === playerId) || null;
}

function clearGizmosState() {
  currentGizmosView = null;
  gizmosResearchOrder = [];
  exitGizmosExplainMode();
  if (gizmosPhaseLabel) gizmosPhaseLabel.textContent = "-";
  if (gizmosTurnLabel) gizmosTurnLabel.textContent = "-";
  if (gizmosBagCountLabel) gizmosBagCountLabel.textContent = "-";
  if (gizmosFinalRoundLabel) gizmosFinalRoundLabel.textContent = "-";
  if (gizmosWinnerLabel) gizmosWinnerLabel.textContent = "-";
  if (gizmosPrompt) gizmosPrompt.textContent = "Waiting for state…";
  if (gizmosEnergyRow) gizmosEnergyRow.innerHTML = "";
  if (gizmosDisplay) gizmosDisplay.innerHTML = "";
  if (gizmosYou) gizmosYou.innerHTML = "";
  if (gizmosActions) gizmosActions.innerHTML = "";
  if (gizmosPlayers) gizmosPlayers.innerHTML = "";
  if (gizmosResearchCards) gizmosResearchCards.innerHTML = "";
  if (gizmosResearchWrap) gizmosResearchWrap.classList.add("hidden");
  if (gizmosHelpModal) setModalVisible(gizmosHelpModal, false);
  if (gizmosExplainModal) setModalVisible(gizmosExplainModal, false);
}

function showGizmosHeaderActions(show) {
  if (!gizmosHeaderActions) return;
  gizmosHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    exitGizmosExplainMode();
    if (gizmosHelpModal) setModalVisible(gizmosHelpModal, false);
    if (gizmosExplainModal) setModalVisible(gizmosExplainModal, false);
  }
}

function openGizmosHelpModal() {
  if (!gizmosHelpContent || !gizmosHelpModal) return;
  gizmosHelpContent.innerHTML = GIZMOS_HELP_HTML;
  setModalVisible(gizmosHelpModal, true);
}

function setGizmosExplanation(node, explanation) {
  if (!node || !explanation) return node;
  const details = Array.isArray(explanation.details) ? explanation.details : [];
  node.dataset.gizmosExplain = "1";
  node.dataset.gizmosExplainTitle = explanation.title || "";
  node.dataset.gizmosExplainDescription = explanation.description || "";
  node.dataset.gizmosExplainDetails = JSON.stringify(details);
  return node;
}

function buildGizmosExplanationHtml(explanation) {
  const details = Array.isArray(explanation && explanation.details) ? explanation.details : [];
  const listHtml = details.length ? `<ul>${details.map((item) => `<li>${item}</li>`).join("")}</ul>` : "";
  const description = explanation && explanation.description ? `<p>${explanation.description}</p>` : "";
  return `
    <h4>${(explanation && explanation.title) || "Explanation"}</h4>
    ${description}
    ${listHtml}
  `;
}

function showGizmosExplanation(explanation) {
  if (!gizmosExplainContent || !gizmosExplainModal) return;
  gizmosExplainContent.innerHTML = buildGizmosExplanationHtml(explanation);
  setModalVisible(gizmosExplainModal, true);
}

function gizmosExplainableNodes() {
  return Array.from(document.querySelectorAll("#gizmosPanel [data-gizmos-explain]"));
}

function updateGizmosExplainModeClasses(enabled) {
  gizmosExplainableNodes().forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
}

function toggleGizmosExplainMode() {
  gizmosExplainMode = !gizmosExplainMode;
  document.body.classList.toggle("gizmos-explain-mode", gizmosExplainMode);
  updateGizmosExplainModeClasses(gizmosExplainMode);
  if (gizmosExplainBtn) {
    gizmosExplainBtn.classList.toggle("active", gizmosExplainMode);
  }
}

function exitGizmosExplainMode() {
  if (!gizmosExplainMode) return;
  gizmosExplainMode = false;
  document.body.classList.remove("gizmos-explain-mode");
  updateGizmosExplainModeClasses(false);
  if (gizmosExplainBtn) {
    gizmosExplainBtn.classList.remove("active");
  }
}

function gizmosFindExplainTargetFromNode(node) {
  if (!node || !node.closest) return null;
  const target = node.closest("[data-gizmos-explain]");
  if (!target || !(gizmosPanel && gizmosPanel.contains(target))) return null;
  return target;
}

function gizmosFindButtonAtPoint(x, y) {
  if (typeof document.elementsFromPoint !== "function") return null;
  const elements = document.elementsFromPoint(x, y);
  for (const element of elements) {
    if (element instanceof HTMLButtonElement) return element;
    if (element.closest) {
      const button = element.closest("button");
      if (button instanceof HTMLButtonElement) return button;
    }
  }
  return null;
}

function gizmosFindExplainTargetAtPoint(x, y) {
  if (typeof document.elementsFromPoint !== "function") return null;
  const elements = document.elementsFromPoint(x, y);
  for (const element of elements) {
    const target = gizmosFindExplainTargetFromNode(element);
    if (target) return target;
  }
  return null;
}

function gizmosIgnoredExplainButton(button) {
  return button === gizmosExplainBtn
    || button === gizmosHelpBtn
    || button === gizmosHelpModalCloseBtn
    || button === gizmosExplainModalCloseBtn;
}

function gizmosExplanationFromNode(node) {
  if (!node || !node.dataset) return null;
  let details = [];
  if (node.dataset.gizmosExplainDetails) {
    try {
      details = JSON.parse(node.dataset.gizmosExplainDetails);
    } catch (_error) {
      details = [];
    }
  }
  return {
    title: node.dataset.gizmosExplainTitle || "Explanation",
    description: node.dataset.gizmosExplainDescription || "",
    details,
  };
}

function gizmosCardExplanation(card, location) {
  const locationLabel = GIZMOS_LOCATION_LABELS[location] || location;
  const details = [
    `Location: ${locationLabel}`,
    `Panel: ${GIZMOS_PANEL_LABELS[card.panel] || card.panel}`,
    `Energy: ${GIZMOS_ENERGY_LABELS[card.energy_type] || card.energy_icon || card.energy_type || "Unknown"}`,
    `Cost: ${card.cost}`,
    `VP: ${card.vp}`,
  ];
  if (location === "display") {
    details.push("Use the buttons on the card to File it or Build it when legal.");
  } else if (location === "archive") {
    details.push("Archive cards are public in this digital version.");
  } else if (location === "research") {
    details.push("Cards you do not keep go back to the bottom of the deck in the chosen order.");
  } else if (location === "active") {
    details.push("Built Gizmos can trigger later in the same turn if their condition matches.");
  }
  return {
    title: card.title,
    description: card.text,
    details,
  };
}

function gizmosSyncResearchOrder(cards) {
  const ids = Array.isArray(cards) ? cards.map((card) => card.id) : [];
  if (ids.length === 0) {
    gizmosResearchOrder = [];
    return;
  }
  const current = gizmosResearchOrder.filter((cardId) => ids.includes(cardId));
  ids.forEach((cardId) => {
    if (!current.includes(cardId)) current.push(cardId);
  });
  gizmosResearchOrder = current;
}

function gizmosMoveResearchCard(cardId, delta) {
  const index = gizmosResearchOrder.indexOf(cardId);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= gizmosResearchOrder.length) return;
  const next = [...gizmosResearchOrder];
  const [card] = next.splice(index, 1);
  next.splice(nextIndex, 0, card);
  gizmosResearchOrder = next;
  renderGizmosResearch(currentGizmosView);
}

function gizmosResolveResearch(choice, cardId) {
  if (!currentGizmosView || !currentGizmosView.prompt || !currentGizmosView.prompt.research) return;
  const returnOrder = choice === "none" ? [...gizmosResearchOrder] : gizmosResearchOrder.filter((id) => id !== cardId);
  const payload = {
    type: "resolve_research",
    choice,
    return_order: returnOrder,
  };
  if (choice !== "none" && cardId) {
    payload.card_id = cardId;
  }
  sendAction(payload);
}

function createGizmosButton(label, onClick, disabled = false, variant = "", explanation = null) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = variant ? `gizmos-btn ${variant}` : "gizmos-btn";
  button.disabled = !!disabled;
  setGizmosExplanation(button, explanation);
  if (!disabled) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function createGizmosEnergyButton(view, color) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `gizmos-energy-chip color-${color}`;
  button.textContent = GIZMOS_ENERGY_LABELS[color] || color;

  const prompt = view.prompt || {};
  const canPick = gizmosCan(view, "pick_energy");
  let enabled = false;
  if (canPick && prompt.phase === "action") {
    enabled = true;
  } else if (canPick && prompt.phase === "bonus_action" && prompt.bonus_context && prompt.bonus_context.kind === "pick") {
    const allowed = Array.isArray(prompt.bonus_context.allowed_colors) ? prompt.bonus_context.allowed_colors : [];
    enabled = allowed.includes(color);
  }
  button.disabled = !enabled;
  setGizmosExplanation(button, {
    title: GIZMOS_ENERGY_LABELS[color] || color,
    description: "Take this visible energy from the row. In Explain mode, this chip only shows what the action does and does not actually pick it.",
    details: [
      "Picking energy is one of the four base actions.",
      enabled
        ? "This color is currently legal to pick."
        : "This color is not currently legal in the current phase or bonus restriction.",
    ],
  });
  if (enabled) {
    button.addEventListener("click", () => sendAction({ type: "pick_energy", color }));
  }
  return button;
}

function createGizmosCard(view, card, location) {
  const cardEl = document.createElement("article");
  cardEl.className = `gizmos-card level-${card.level}`;
  setGizmosExplanation(cardEl, gizmosCardExplanation(card, location));

  const top = document.createElement("div");
  top.className = "gizmos-card-top";
  top.innerHTML = `<span>${card.panel_icon} ${GIZMOS_PANEL_LABELS[card.panel] || card.panel}</span><span>${card.energy_icon} Cost ${card.cost}</span>`;
  cardEl.appendChild(top);

  const title = document.createElement("div");
  title.className = "gizmos-card-title";
  title.textContent = card.title;
  cardEl.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "gizmos-card-meta";
  meta.innerHTML = `<span>LV ${card.level}</span><span>⭐ ${card.vp}</span>`;
  cardEl.appendChild(meta);

  const text = document.createElement("div");
  text.className = "gizmos-card-text";
  text.textContent = card.text;
  cardEl.appendChild(text);

  const controls = document.createElement("div");
  controls.className = "gizmos-card-actions";

  const prompt = view.prompt || {};
  const canFile = gizmosCan(view, "file_display") && location === "display";
  const canBuildDisplay = gizmosCan(view, "build_display") && location === "display";
  const canBuildArchive = gizmosCan(view, "build_archive") && location === "archive";
  const isFreeLevel1 = prompt.phase === "bonus_action" && prompt.bonus_context && prompt.bonus_context.kind === "build_free_level1";

  if (canFile && prompt.phase === "action") {
    controls.appendChild(createGizmosButton(
      "🗂️ File",
      () => sendAction({ type: "file_display", card_id: card.id }),
      false,
      "",
      {
        title: "File This Gizmo",
        description: "Move this display card into your Archive. Filing usually uses your base action.",
        details: [
          "Archive cards remain public in this implementation.",
          "After filing, matching File Gizmos may trigger.",
        ],
      }
    ));
  }
  if (canFile && prompt.phase === "bonus_action" && prompt.bonus_context && prompt.bonus_context.kind === "file") {
    controls.appendChild(createGizmosButton(
      "🗂️ File",
      () => sendAction({ type: "file_display", card_id: card.id }),
      false,
      "",
      {
        title: "Bonus File",
        description: "Resolve a bonus File and move this display card into your Archive.",
        details: [
          "This File comes from a triggered effect rather than your normal base action.",
        ],
      }
    ));
  }
  if (canBuildDisplay) {
    controls.appendChild(
      createGizmosButton(
        isFreeLevel1 ? "🛠️ Free Build" : "🛠️ Build",
        () => sendAction({ type: "build_display", card_id: card.id }),
        !card.buildable,
        "",
        {
          title: isFreeLevel1 ? "Free Build This Gizmo" : "Build This Gizmo",
          description: "Build this display card into your lab. The server auto-pays with your stored energy and any legal unused converters.",
          details: [
            isFreeLevel1 ? "This build ignores energy cost, but only works for Level 1 Gizmos." : "If this button is disabled, your current energy and converters cannot pay the cost.",
            "After building, matching Build Gizmos may trigger.",
          ],
        }
      )
    );
  }
  if (canBuildArchive) {
    controls.appendChild(
      createGizmosButton(
        isFreeLevel1 ? "🛠️ Free Build" : "🛠️ Build",
        () => sendAction({ type: "build_archive", card_id: card.id }),
        !card.buildable,
        "",
        {
          title: isFreeLevel1 ? "Free Build From Archive" : "Build From Archive",
          description: "Build this archived card into your lab. The server auto-pays with your stored energy and any legal unused converters.",
          details: [
            "Archive cards remain public in this implementation.",
            isFreeLevel1 ? "This build ignores cost, but only for Level 1 Gizmos." : "If this button is disabled, you cannot currently pay for this archived card.",
          ],
        }
      )
    );
  }

  if (controls.childNodes.length) {
    cardEl.appendChild(controls);
  }
  return cardEl;
}

function renderGizmosEnergyRow(view) {
  if (!gizmosEnergyRow) return;
  gizmosEnergyRow.innerHTML = "";
  const row = Array.isArray(view.energy_row) ? view.energy_row : [];
  if (!row.length) {
    gizmosEnergyRow.textContent = "-";
    return;
  }
  row.forEach((color) => {
    gizmosEnergyRow.appendChild(createGizmosEnergyButton(view, color));
  });
}

function renderGizmosDisplay(view) {
  if (!gizmosDisplay) return;
  gizmosDisplay.innerHTML = "";
  ["3", "2", "1"].forEach((levelKey) => {
    const section = document.createElement("section");
    section.className = "gizmos-level-section";
    const title = document.createElement("h4");
    title.textContent = `Level ${levelKey}`;
    section.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "gizmos-cards";
    const cards = (view.display && view.display[levelKey]) || [];
    let hasCard = false;
    cards.forEach((card) => {
      if (!card) return;
      hasCard = true;
      grid.appendChild(createGizmosCard(view, card, "display"));
    });
    if (!hasCard) {
      const empty = document.createElement("div");
      empty.className = "gizmos-empty";
      empty.textContent = "Deck empty";
      grid.appendChild(empty);
    }
    section.appendChild(grid);
    gizmosDisplay.appendChild(section);
  });
}

function renderGizmosYou(view) {
  if (!gizmosYou) return;
  gizmosYou.innerHTML = "";
  const you = gizmosSelf(view);
  if (!you) {
    gizmosYou.textContent = "-";
    return;
  }
  setGizmosExplanation(gizmosYou, {
    title: "Your Lab",
    description: "This panel summarizes your stored energy, archive, score, and all built Gizmos grouped by panel.",
    details: [
      "Archive and stored energy are public in this digital implementation.",
      "Projected score includes printed VP, VP tokens, and currently visible end-game scoring effects.",
    ],
  });

  const stats = document.createElement("div");
  stats.className = "gizmos-player-stats";
  stats.innerHTML = `
    <div>Energy: <strong>${(you.storage || []).map((color) => GIZMOS_ENERGY_LABELS[color] || color).join(" ") || "-"}</strong></div>
    <div>Storage: <strong>${(you.storage || []).length}/${you.storage_limit}</strong></div>
    <div>Archive Limit: <strong>${you.file_limit}</strong></div>
    <div>Research: <strong>${you.research_amount}</strong></div>
    <div>VP Tokens: <strong>${you.vp_tokens_total}</strong></div>
    <div>Score: <strong>${you.score_now}</strong> (Projected ${you.projected_score})</div>
    <div>Archive: <strong>${(you.archive || []).length}</strong></div>
  `;
  gizmosYou.appendChild(stats);

  const archiveTitle = document.createElement("h4");
  archiveTitle.textContent = "Archive";
  gizmosYou.appendChild(archiveTitle);
  const archiveGrid = document.createElement("div");
  archiveGrid.className = "gizmos-cards";
  if ((you.archive || []).length) {
    you.archive.forEach((card) => archiveGrid.appendChild(createGizmosCard(view, card, "archive")));
  } else {
    const empty = document.createElement("div");
    empty.className = "gizmos-empty";
    empty.textContent = "Archive is empty";
    archiveGrid.appendChild(empty);
  }
  gizmosYou.appendChild(archiveGrid);

  const activeTitle = document.createElement("h4");
  activeTitle.textContent = "Active Gizmos";
  gizmosYou.appendChild(activeTitle);
  const activeWrap = document.createElement("div");
  activeWrap.className = "gizmos-active-groups";
  Object.entries(you.active || {}).forEach(([panel, cards]) => {
    if (!Array.isArray(cards) || !cards.length) return;
    const group = document.createElement("section");
    group.className = "gizmos-active-group";
    const heading = document.createElement("div");
    heading.className = "gizmos-active-heading";
    heading.textContent = GIZMOS_PANEL_LABELS[panel] || panel;
    group.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "gizmos-cards compact";
    cards.forEach((card) => grid.appendChild(createGizmosCard(view, card, "active")));
    group.appendChild(grid);
    activeWrap.appendChild(group);
  });
  gizmosYou.appendChild(activeWrap);
}

function renderGizmosResearch(view) {
  if (!gizmosResearchWrap || !gizmosResearchCards) return;
  const research = view && view.prompt ? view.prompt.research : null;
  if (!research || !Array.isArray(research.cards) || !research.cards.length) {
    gizmosResearchWrap.classList.add("hidden");
    gizmosResearchCards.innerHTML = "";
    gizmosResearchOrder = [];
    return;
  }

  gizmosSyncResearchOrder(research.cards);
  gizmosResearchWrap.classList.remove("hidden");
  gizmosResearchCards.innerHTML = "";

  gizmosResearchOrder.forEach((cardId) => {
    const card = research.cards.find((entry) => entry.id === cardId);
    if (!card) return;
    const cardEl = createGizmosCard(view, card, "research");
    const orderRow = document.createElement("div");
    orderRow.className = "gizmos-card-actions";
    orderRow.appendChild(createGizmosButton(
      "◀",
      () => gizmosMoveResearchCard(card.id, -1),
      gizmosResearchOrder[0] === card.id,
      "",
      {
        title: "Move Left",
        description: "Move this researched card one step left in the return order.",
        details: [
          "The leftmost leftover card goes deepest to the bottom of the deck.",
        ],
      }
    ));
    orderRow.appendChild(createGizmosButton(
      "▶",
      () => gizmosMoveResearchCard(card.id, 1),
      gizmosResearchOrder[gizmosResearchOrder.length - 1] === card.id,
      "",
      {
        title: "Move Right",
        description: "Move this researched card one step right in the return order.",
        details: [
          "The rightmost leftover card returns closest to the top among the returned cards.",
        ],
      }
    ));
    orderRow.appendChild(createGizmosButton(
      "🛠️ Build",
      () => gizmosResolveResearch("build", card.id),
      !card.buildable,
      "",
      {
        title: "Build Researched Card",
        description: "Build this researched card now. The other researched cards return to the bottom in the current order.",
        details: [
          card.buildable ? "This researched card is currently payable." : "This researched card is not currently payable with your energy and converters.",
        ],
      }
    ));
    orderRow.appendChild(createGizmosButton(
      "🗂️ File",
      () => gizmosResolveResearch("file", card.id),
      false,
      "",
      {
        title: "File Researched Card",
        description: "Archive this researched card. The other researched cards return to the bottom in the current order.",
        details: [
          "Filing from Research still counts as your choice for this Research action.",
        ],
      }
    ));
    cardEl.appendChild(orderRow);
    gizmosResearchCards.appendChild(cardEl);
  });
}

function renderGizmosPrompt(view) {
  if (!gizmosPrompt) return;
  const prompt = view.prompt || {};
  const phase = prompt.phase || view.phase;
  if (phase === "choose_effect" && Array.isArray(prompt.pending_effects)) {
    const text = prompt.pending_effects.length
      ? `Choose a triggered Gizmo to resolve.`
      : "No triggered Gizmos remain.";
    gizmosPrompt.textContent = text;
    return;
  }
  if (phase === "bonus_action" && prompt.bonus_context) {
    const ctx = prompt.bonus_context;
    if (ctx.kind === "pick") {
      gizmosPrompt.textContent = `Resolve bonus Pick (${ctx.remaining} left).`;
      return;
    }
    if (ctx.kind === "file") {
      gizmosPrompt.textContent = "Resolve bonus File from the display.";
      return;
    }
    if (ctx.kind === "research") {
      gizmosPrompt.textContent = "Resolve bonus Research. Choose a level below.";
      return;
    }
    if (ctx.kind === "build_free_level1") {
      gizmosPrompt.textContent = "Resolve free Level 1 build.";
      return;
    }
  }
  if (phase === "research") {
    gizmosPrompt.textContent = "Resolve your Research cards and set their bottom order.";
    return;
  }
  gizmosPrompt.textContent = "Use the Energy Row, Display, or action buttons to take your turn.";
}

function renderGizmosActions(view) {
  if (!gizmosActions) return;
  gizmosActions.innerHTML = "";
  const prompt = view.prompt || {};

  if (prompt.phase === "choose_effect" && Array.isArray(prompt.pending_effects)) {
    prompt.pending_effects.forEach((effect) => {
      gizmosActions.appendChild(
        createGizmosButton(
          effect.label,
          () => sendAction({ type: "resolve_effect", effect_id: effect.effect_id }),
          !effect.resolvable,
          "",
          {
            title: "Resolve Triggered Gizmo",
            description: effect.label,
            details: [
              "Triggered effects resolve one at a time.",
              effect.resolvable ? "This effect can currently be resolved." : "This effect is currently not resolvable.",
            ],
          }
        )
      );
    });
  }

  if (gizmosCan(view, "pass_effects")) {
    gizmosActions.appendChild(createGizmosButton(
      "End Chain",
      () => sendAction({ type: "pass_effects" }),
      false,
      "ghost",
      {
        title: "End Chain",
        description: "Stop resolving optional triggered effects and continue the turn flow.",
        details: [
          "Use this when you do not want to resolve any more optional triggers.",
        ],
      }
    ));
  }

  if (gizmosCan(view, "research") && (prompt.phase === "action" || (prompt.phase === "bonus_action" && prompt.bonus_context && prompt.bonus_context.kind === "research"))) {
    [1, 2, 3].forEach((level) => {
      gizmosActions.appendChild(createGizmosButton(
        `🔍 Research L${level}`,
        () => sendAction({ type: "research", level }),
        false,
        "",
        {
          title: `Research Level ${level}`,
          description: `Draw up to your Research amount from the Level ${level} deck, then choose one to Build or File, or return them all.`,
          details: [
            "Cards you do not keep go to the bottom of the chosen deck.",
          ],
        }
      ));
    });
  }

  if (gizmosCan(view, "pass_turn") && prompt.phase === "action") {
    gizmosActions.appendChild(createGizmosButton(
      "Pass Turn",
      () => sendAction({ type: "pass_turn" }),
      false,
      "ghost",
      {
        title: "Pass Turn",
        description: "Pass only when the server sees no legal base action left for you.",
        details: [
          "If you still have a legal Pick, File, Build, or Research, the server will reject this.",
        ],
      }
    ));
  }
}

function renderGizmosPlayers(view) {
  if (!gizmosPlayers) return;
  gizmosPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const card = document.createElement("section");
    card.className = "gizmos-player-card";
    setGizmosExplanation(card, {
      title: `${player.name}`,
      description: "Public summary of this player's machine, score, and archived cards.",
      details: [
        `Energy: ${(player.storage || []).map((color) => GIZMOS_ENERGY_LABELS[color] || color).join(" ") || "-"}`,
        `Archive count: ${(player.archive || []).length}`,
        `Level 3 Gizmos: ${player.level3_count}`,
      ],
    });
    if (player.player_id === view.current_turn) card.classList.add("current");
    if (player.player_id === view.you) card.classList.add("you");
    const title = document.createElement("div");
    title.className = "gizmos-player-name";
    title.textContent = `${player.name}${player.player_id === view.you ? " · you" : ""}`;
    card.appendChild(title);

    const stats = document.createElement("div");
    stats.className = "gizmos-player-stats";
    stats.innerHTML = `
      <div>Energy: <strong>${(player.storage || []).map((color) => GIZMOS_ENERGY_LABELS[color] || color).join(" ") || "-"}</strong></div>
      <div>Score: <strong>${player.score_now}</strong> (Projected ${player.projected_score})</div>
      <div>Archive: <strong>${(player.archive || []).length}</strong></div>
      <div>Level 3: <strong>${player.level3_count}</strong></div>
    `;
    card.appendChild(stats);

    const archive = document.createElement("div");
    archive.className = "gizmos-player-archive-line";
    archive.textContent = `Archive: ${(player.archive || []).map((card) => card.title).join(" | ") || "-"}`;
    card.appendChild(archive);
    gizmosPlayers.appendChild(card);
  });
}

function renderGizmosGameState(data) {
  const view = data.view;
  currentGizmosView = view;
  if (currentGameType !== "gizmos") {
    currentGameType = "gizmos";
    setGamePanelVisibility("gizmos");
  }

  if (gizmosPhaseLabel) gizmosPhaseLabel.textContent = view.phase || "-";
  if (gizmosTurnLabel) gizmosTurnLabel.textContent = view.current_turn ? findPlayerName(view, view.current_turn) : "-";
  if (gizmosBagCountLabel) gizmosBagCountLabel.textContent = `${view.energy_bag_count ?? "-"}`;
  if (gizmosFinalRoundLabel) {
    if (view.final_round && view.final_round.active) {
      const triggerName = view.final_round.triggered_by ? findPlayerName(view, view.final_round.triggered_by) : "-";
      gizmosFinalRoundLabel.textContent = `Yes (${triggerName})`;
    } else {
      gizmosFinalRoundLabel.textContent = "No";
    }
  }
  if (gizmosWinnerLabel) {
    gizmosWinnerLabel.textContent = Array.isArray(view.winner) && view.winner.length
      ? view.winner.map((playerId) => findPlayerName(view, playerId)).join(", ")
      : "-";
  }

  renderGizmosPrompt(view);
  renderGizmosEnergyRow(view);
  renderGizmosDisplay(view);
  renderGizmosYou(view);
  renderGizmosResearch(view);
  renderGizmosActions(view);
  renderGizmosPlayers(view);
  updateGizmosExplainModeClasses(gizmosExplainMode);
  logGameEvents(data);
}

if (gizmosResearchSkipBtn) {
  setGizmosExplanation(gizmosResearchSkipBtn, {
    title: "Skip Research Choice",
    description: "Keep none of the researched cards. They all return to the bottom of the deck in the current left-to-right order.",
    details: [
      "Use the ◀ / ▶ buttons first if you want to change the return order.",
    ],
  });
  gizmosResearchSkipBtn.addEventListener("click", () => gizmosResolveResearch("none"));
}

if (gizmosHelpBtn) {
  gizmosHelpBtn.addEventListener("click", openGizmosHelpModal);
}

if (gizmosExplainBtn) {
  gizmosExplainBtn.addEventListener("click", toggleGizmosExplainMode);
}

if (gizmosHelpModalCloseBtn) {
  gizmosHelpModalCloseBtn.addEventListener("click", () => {
    if (gizmosHelpModal) setModalVisible(gizmosHelpModal, false);
  });
}

if (gizmosExplainModalCloseBtn) {
  gizmosExplainModalCloseBtn.addEventListener("click", () => {
    if (gizmosExplainModal) setModalVisible(gizmosExplainModal, false);
  });
}

if (gizmosHelpModal) {
  gizmosHelpModal.addEventListener("click", (event) => {
    if (event.target === gizmosHelpModal) {
      setModalVisible(gizmosHelpModal, false);
    }
  });
}

if (gizmosExplainModal) {
  gizmosExplainModal.addEventListener("click", (event) => {
    if (event.target === gizmosExplainModal) {
      setModalVisible(gizmosExplainModal, false);
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (gizmosExplainMode) {
    exitGizmosExplainMode();
    return;
  }
  if (gizmosHelpModal && !gizmosHelpModal.classList.contains("hidden")) {
    setModalVisible(gizmosHelpModal, false);
  }
  if (gizmosExplainModal && !gizmosExplainModal.classList.contains("hidden")) {
    setModalVisible(gizmosExplainModal, false);
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!gizmosExplainMode || currentGameType !== "gizmos") return;

  const button = gizmosFindButtonAtPoint(event.clientX, event.clientY);
  if (button) {
    if (gizmosIgnoredExplainButton(button)) return;
    event.preventDefault();
    event.stopPropagation();
    const explanation = button.dataset && button.dataset.gizmosExplain ? gizmosExplanationFromNode(button) : null;
    if (explanation) {
      showGizmosExplanation(explanation);
      exitGizmosExplainMode();
    }
    return;
  }

  const target = gizmosFindExplainTargetAtPoint(event.clientX, event.clientY);
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  showGizmosExplanation(gizmosExplanationFromNode(target));
  exitGizmosExplainMode();
}, true);

document.addEventListener("click", (event) => {
  if (!gizmosExplainMode || currentGameType !== "gizmos") return;

  const button = event.target.closest ? event.target.closest("button") : null;
  if (button) {
    if (gizmosIgnoredExplainButton(button)) return;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const target = gizmosFindExplainTargetFromNode(event.target);
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
}, true);
