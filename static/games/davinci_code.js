let currentDaVinciCodeView = null;
let daVinciSelectedTarget = null;

const davinciCodeConfigBox = document.getElementById("davinciCodeConfigBox");
const davinciCodeModeSelect = document.getElementById("davinciCodeModeSelect");

const davinciCodeHeaderActions = document.getElementById("davinciCodeHeaderActions");
const davinciCodeHelpBtn = document.getElementById("davinciCodeHelpBtn");
const davinciCodeExplainBtn = document.getElementById("davinciCodeExplainBtn");
const davinciCodeHelpModal = document.getElementById("davinciCodeHelpModal");
const davinciCodeHelpModalCloseBtn = document.getElementById("davinciCodeHelpModalCloseBtn");
const davinciCodeHelpContent = document.getElementById("davinciCodeHelpContent");
const davinciCodeExplainModal = document.getElementById("davinciCodeExplainModal");
const davinciCodeExplainModalCloseBtn = document.getElementById("davinciCodeExplainModalCloseBtn");
const davinciCodeExplainContent = document.getElementById("davinciCodeExplainContent");

const davinciCodePanelEl = document.getElementById("davinciCodePanel");
const davinciCodePhaseLabel = document.getElementById("davinciCodePhase");
const davinciCodeModeLabel = document.getElementById("davinciCodeMode");
const davinciCodeTurnLabel = document.getElementById("davinciCodeTurn");
const davinciCodeDeckLabel = document.getElementById("davinciCodeDeck");
const davinciCodeDetailLabel = document.getElementById("davinciCodeDetail");
const davinciCodeWinnersLabel = document.getElementById("davinciCodeWinners");
const davinciCodeSetupSection = document.getElementById("davinciCodeSetup");
const davinciCodeSetupOptions = document.getElementById("davinciCodeSetupOptions");
const davinciCodeTable = document.getElementById("davinciCodeTable");
const davinciCodeGuessTarget = document.getElementById("davinciCodeGuessTarget");
const davinciCodeGuessColor = document.getElementById("davinciCodeGuessColor");
const davinciCodeGuessValue = document.getElementById("davinciCodeGuessValue");
const davinciCodeGuessBtn = document.getElementById("davinciCodeGuessBtn");
const davinciCodePending = document.getElementById("davinciCodePending");
const davinciCodeControls = document.getElementById("davinciCodeControls");
const davinciCodeLog = document.getElementById("davinciCodeLog");

const DAVINCI_HELP_HTML = `
  <h3>Goal</h3>
  <p>Be the last player with at least one hidden tile in your code row.</p>

  <h3>Turn Flow</h3>
  <ol>
    <li>At the start of your turn you draw one tile. Only you can see its face.</li>
    <li>Click one hidden opponent tile, choose a color and value, then submit your guess.</li>
    <li>If you are correct, that opponent tile is revealed and you may continue or stop.</li>
    <li>If you stop, your drawn tile is inserted hidden. If you miss, your drawn tile is inserted revealed.</li>
  </ol>

  <h3>Row Order</h3>
  <p>Number tiles always stay in ascending order from left to right. If two tiles show the same number, dark stays left of light.</p>

  <h3>Empty Deck</h3>
  <p>When the draw pile runs out, wrong guesses no longer reveal a drawn tile. Instead, you must reveal one of your own hidden tiles.</p>

  <h3>Advanced Mode</h3>
  <ul>
    <li>Two dash tiles are added to the deck.</li>
    <li>Players who start with a dash tile must choose its initial position before the game begins.</li>
    <li>Whenever a dash is involved, the server shows the legal insertion positions and you choose one.</li>
  </ul>
`;

function daVinciCan(view, action) {
  return Array.isArray(view && view.legal_actions) && view.legal_actions.includes(action);
}

function daVinciFindSelf(view) {
  if (!view || !Array.isArray(view.players)) return null;
  return view.players.find((player) => player.you) || null;
}

function clearDaVinciCodeState() {
  currentDaVinciCodeView = null;
  daVinciSelectedTarget = null;
  if (davinciCodePhaseLabel) davinciCodePhaseLabel.textContent = "-";
  if (davinciCodeModeLabel) davinciCodeModeLabel.textContent = "-";
  if (davinciCodeTurnLabel) davinciCodeTurnLabel.textContent = "-";
  if (davinciCodeDeckLabel) davinciCodeDeckLabel.textContent = "-";
  if (davinciCodeDetailLabel) davinciCodeDetailLabel.textContent = "-";
  if (davinciCodeWinnersLabel) davinciCodeWinnersLabel.textContent = "-";
  if (davinciCodeSetupOptions) davinciCodeSetupOptions.innerHTML = "";
  if (davinciCodeTable) davinciCodeTable.innerHTML = "";
  if (davinciCodeGuessTarget) davinciCodeGuessTarget.textContent = "Select a hidden opponent tile.";
  if (davinciCodePending) davinciCodePending.textContent = "-";
  if (davinciCodeControls) davinciCodeControls.innerHTML = "";
  if (davinciCodeLog) davinciCodeLog.innerHTML = "";
  if (davinciCodeSetupSection) {
    davinciCodeSetupSection.classList.add("hidden");
    davinciCodeSetupSection.setAttribute("aria-hidden", "true");
  }
  if (davinciCodeGuessValue) {
    davinciCodeGuessValue.innerHTML = "";
  }
  if (davinciCodeHelpModal) setModalVisible(davinciCodeHelpModal, false);
  if (davinciCodeExplainModal) setModalVisible(davinciCodeExplainModal, false);
  updateDaVinciGuessButton();
}

function updateDavinciCodeConfigRow() {
  const showRow = currentRoomState && currentGameType === "davinci_code" && currentRoomState.status === "lobby";
  if (davinciCodeConfigBox) {
    davinciCodeConfigBox.classList.toggle("hidden", !showRow);
    davinciCodeConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (currentGameType === "davinci_code" && currentRoomState && currentRoomState.status === "lobby") {
    renderDaVinciCodeRoomState(currentRoomState);
  }
}

function daVinciModeSummary(mode) {
  return mode === "advanced"
    ? "Advanced mode adds two dash tiles and may require manual placement choices."
    : "Standard mode uses only numbered light and dark tiles.";
}

function renderDaVinciCodeRoomState(state) {
  if (!state || currentGameType !== "davinci_code" || state.status !== "lobby") {
    return;
  }
  currentDaVinciCodeView = null;
  daVinciSelectedTarget = null;
  const players = Array.isArray(state.players)
    ? [...state.players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    : [];
  const readyCount = players.filter((player) => player && player.ready).length;
  const mode = davinciCodeModeSelect ? davinciCodeModeSelect.value || "standard" : "standard";
  const deckSize = mode === "advanced" ? 26 : 24;
  const enoughPlayers = players.length >= 2;
  const seatsRemaining = Math.max(0, 2 - players.length);

  if (davinciCodePhaseLabel) davinciCodePhaseLabel.textContent = "lobby";
  if (davinciCodeModeLabel) davinciCodeModeLabel.textContent = mode;
  if (davinciCodeTurnLabel) davinciCodeTurnLabel.textContent = "Not started";
  if (davinciCodeDeckLabel) davinciCodeDeckLabel.textContent = `${deckSize} tiles`;
  if (davinciCodeDetailLabel) {
    davinciCodeDetailLabel.textContent = enoughPlayers
      ? `${readyCount}/${players.length} ready. Use Room Controls to start.`
      : `Need ${seatsRemaining} more player${seatsRemaining === 1 ? "" : "s"} before the game can start.`;
  }
  if (davinciCodeWinnersLabel) davinciCodeWinnersLabel.textContent = "-";
  if (davinciCodeSetupSection) {
    davinciCodeSetupSection.classList.add("hidden");
    davinciCodeSetupSection.setAttribute("aria-hidden", "true");
  }
  if (davinciCodeGuessTarget) {
    davinciCodeGuessTarget.textContent = enoughPlayers
      ? "Lobby preview active. Hidden opponent tiles become clickable after the start."
      : "Add another player or bot to unlock the board.";
  }
  populateDaVinciGuessValueOptions({ mode });

  if (davinciCodeTable) {
    davinciCodeTable.innerHTML = "";
    const card = document.createElement("section");
    card.className = "davinci-empty-card";

    const title = document.createElement("div");
    title.className = "davinci-empty-title";
    title.textContent = enoughPlayers ? "Lobby Preview" : "Waiting For Players";
    card.appendChild(title);

    const copy = document.createElement("p");
    copy.className = "davinci-empty-copy";
    copy.textContent = enoughPlayers
      ? `Each player starts with four hidden tiles. On your turn you draw one tile, then try to name an opponent tile's color and value.`
      : "Da Vinci Code needs 2-4 players. Add a bot or invite another player to make the board live.";
    card.appendChild(copy);

    const seatList = document.createElement("div");
    seatList.className = "davinci-seat-list";
    players.forEach((player) => {
      const pill = document.createElement("div");
      pill.className = "davinci-seat-pill";
      if (player.ready) pill.classList.add("ready");
      if (player.is_bot) pill.classList.add("bot");
      if (player.player_id === playerId) pill.classList.add("you");
      const tags = [];
      if (player.player_id === playerId) tags.push("you");
      if (player.ready) tags.push("ready");
      if (player.is_bot) tags.push("bot");
      pill.textContent = `${(player.seat ?? 0) + 1}. ${player.name}${tags.length ? ` · ${tags.join(" · ")}` : ""}`;
      seatList.appendChild(pill);
    });
    card.appendChild(seatList);

    const steps = document.createElement("ol");
    steps.className = "davinci-step-list";
    [
      `Mode: ${mode}. ${daVinciModeSummary(mode)}`,
      "Toggle Ready in Room Controls after everyone has joined.",
      "Use Start Game to deal the opening code rows and draw the first tile.",
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      steps.appendChild(item);
    });
    card.appendChild(steps);

    davinciCodeTable.appendChild(card);
  }

  if (davinciCodePending) {
    davinciCodePending.textContent = mode === "advanced"
      ? "Advanced mode warning: dash tiles can force setup or insertion choices."
      : "Standard mode: guesses always declare one color and one value from 0-11.";
  }

  if (davinciCodeControls) {
    davinciCodeControls.innerHTML = "";
    const note = document.createElement("div");
    note.className = "davinci-lobby-note";
    note.textContent = enoughPlayers
      ? "Room Controls are on the left: ready up, then press Start Game."
      : "Room Controls are on the left: add at least one more player or bot.";
    davinciCodeControls.appendChild(note);
  }

  if (davinciCodeLog) {
    davinciCodeLog.innerHTML = "";
    const readyEntry = document.createElement("div");
    readyEntry.className = "davinci-log-entry kind-setup";
    readyEntry.textContent = enoughPlayers
      ? `${readyCount}/${players.length} players are ready in the lobby.`
      : `Lobby is waiting for ${seatsRemaining} more player${seatsRemaining === 1 ? "" : "s"}.`;
    davinciCodeLog.appendChild(readyEntry);

    const modeEntry = document.createElement("div");
    modeEntry.className = "davinci-log-entry kind-turn";
    modeEntry.textContent = `Current mode: ${mode}. ${daVinciModeSummary(mode)}`;
    davinciCodeLog.appendChild(modeEntry);
  }

  updateDaVinciGuessButton();
}

function showDaVinciCodeHeaderActions(show) {
  if (!davinciCodeHeaderActions) return;
  davinciCodeHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    if (davinciCodeHelpModal) setModalVisible(davinciCodeHelpModal, false);
    if (davinciCodeExplainModal) setModalVisible(davinciCodeExplainModal, false);
  }
}

function openDaVinciCodeHelpModal() {
  if (!davinciCodeHelpContent || !davinciCodeHelpModal) return;
  davinciCodeHelpContent.innerHTML = DAVINCI_HELP_HTML;
  setModalVisible(davinciCodeHelpModal, true);
}

function buildDaVinciExplainHtml(view) {
  const legal = Array.isArray(view && view.legal_actions) ? view.legal_actions : [];
  const items = [];
  if (view && view.phase_detail) {
    items.push(`<li>${view.phase_detail}</li>`);
  }
  if (legal.includes("guess_tile")) {
    items.push("<li>Click one hidden opponent tile on the table, then choose the color and value below the board.</li>");
  }
  if (legal.includes("continue_guess")) {
    items.push("<li>You guessed correctly. Continue to pressure opponents, or stop and keep your drawn tile hidden.</li>");
  }
  if (legal.includes("reveal_own_tile")) {
    items.push("<li>The draw pile is empty and your last guess failed. Reveal one of your own hidden tiles.</li>");
  }
  if (legal.includes("insert_pending_tile")) {
    items.push("<li>Your drawn tile needs a manual insertion point. Use one of the legal previews shown below.</li>");
  }
  if (legal.includes("arrange_initial_tiles")) {
    items.push("<li>You started with a dash tile. Pick one legal starting order before turn 1 begins.</li>");
  }
  const selfPlayer = daVinciFindSelf(view);
  const pending = selfPlayer && selfPlayer.pending_tile && selfPlayer.pending_tile.exists
    ? (selfPlayer.pending_tile.face_visible ? selfPlayer.pending_tile.label : "hidden")
    : "none";
  return `
    <h3>Current Focus</h3>
    <p>${view && view.phase_detail ? view.phase_detail : "-"}</p>
    <p><strong>Pending Tile:</strong> ${pending}</p>
    <h3>Available Actions</h3>
    <ul>${items.length ? items.join("") : "<li>No actions available.</li>"}</ul>
  `;
}

function openDaVinciCodeExplainModal() {
  if (!davinciCodeExplainContent || !davinciCodeExplainModal || !currentDaVinciCodeView) return;
  davinciCodeExplainContent.innerHTML = buildDaVinciExplainHtml(currentDaVinciCodeView);
  setModalVisible(davinciCodeExplainModal, true);
}

function daVinciSelectedTargetLabel() {
  if (!currentDaVinciCodeView || !daVinciSelectedTarget) {
    return "Select a hidden opponent tile.";
  }
  const player = (currentDaVinciCodeView.players || []).find((candidate) => candidate.player_id === daVinciSelectedTarget.playerId);
  if (!player) {
    return "Select a hidden opponent tile.";
  }
  return `Target: ${player.name} #${daVinciSelectedTarget.index + 1}`;
}

function populateDaVinciGuessValueOptions(view) {
  if (!davinciCodeGuessValue) return;
  const previous = davinciCodeGuessValue.value;
  davinciCodeGuessValue.innerHTML = "";
  for (let value = 0; value <= 11; value += 1) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    davinciCodeGuessValue.appendChild(option);
  }
  if (view && view.mode === "advanced") {
    const dashOption = document.createElement("option");
    dashOption.value = "dash";
    dashOption.textContent = "━";
    davinciCodeGuessValue.appendChild(dashOption);
  }
  davinciCodeGuessValue.value = Array.from(davinciCodeGuessValue.options).some((option) => option.value === previous)
    ? previous
    : "0";
}

function updateDaVinciGuessButton() {
  if (!davinciCodeGuessBtn) return;
  const view = currentDaVinciCodeView;
  const canGuess = daVinciCan(view, "guess_tile");
  const color = davinciCodeGuessColor ? davinciCodeGuessColor.value : "dark";
  const value = davinciCodeGuessValue ? davinciCodeGuessValue.value : "0";
  const validValue = value === "dash" || value !== "";
  davinciCodeGuessBtn.disabled = !canGuess || !daVinciSelectedTarget || !color || !validValue;
}

function toggleDaVinciTarget(playerId, index) {
  if (!currentDaVinciCodeView || !daVinciCan(currentDaVinciCodeView, "guess_tile")) {
    return;
  }
  if (daVinciSelectedTarget && daVinciSelectedTarget.playerId === playerId && daVinciSelectedTarget.index === index) {
    daVinciSelectedTarget = null;
  } else {
    daVinciSelectedTarget = { playerId, index };
  }
  if (davinciCodeGuessTarget) {
    davinciCodeGuessTarget.textContent = daVinciSelectedTargetLabel();
  }
  renderDaVinciCodeTable(currentDaVinciCodeView);
  updateDaVinciGuessButton();
}

function renderDaVinciCodeSetup(view) {
  if (!davinciCodeSetupSection || !davinciCodeSetupOptions) return;
  const canArrange = daVinciCan(view, "arrange_initial_tiles");
  const options = Array.isArray(view.setup_options) ? view.setup_options : [];
  const show = canArrange || (view.phase === "setup" && options.length > 0);
  davinciCodeSetupSection.classList.toggle("hidden", !show);
  davinciCodeSetupSection.setAttribute("aria-hidden", (!show).toString());
  davinciCodeSetupOptions.innerHTML = "";
  if (!show) return;
  if (!options.length) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = view.phase_detail || "Waiting for setup.";
    davinciCodeSetupOptions.appendChild(hint);
    return;
  }
  options.forEach((option) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "davinci-option-btn";
    btn.textContent = option.preview || option.ordered_tile_ids.join(" ");
    btn.addEventListener("click", () => {
      sendAction({ type: "arrange_initial_tiles", ordered_tile_ids: option.ordered_tile_ids });
    });
    davinciCodeSetupOptions.appendChild(btn);
  });
}

function renderDaVinciCodeTable(view) {
  if (!davinciCodeTable) return;
  davinciCodeTable.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const card = document.createElement("section");
    card.className = "davinci-player-card";
    if (player.you) card.classList.add("you");
    if (player.is_current_turn) card.classList.add("current");
    if (player.eliminated) card.classList.add("out");

    const header = document.createElement("div");
    header.className = "davinci-player-header";
    const name = document.createElement("div");
    name.className = "davinci-player-name";
    name.textContent = `${player.name}${player.you ? " · You" : ""}`;
    const meta = document.createElement("div");
    meta.className = "davinci-player-meta";
    const tags = [];
    tags.push(`${player.hidden_count}/${player.tile_count} hidden`);
    if (player.eliminated) tags.push("Out");
    if (player.is_current_turn) tags.push("Turn");
    meta.textContent = tags.join(" · ");
    header.appendChild(name);
    header.appendChild(meta);
    card.appendChild(header);

    const rack = document.createElement("div");
    rack.className = "davinci-rack";
    (player.tiles || []).forEach((tile) => {
      const isTarget = !!daVinciSelectedTarget && daVinciSelectedTarget.playerId === player.player_id && daVinciSelectedTarget.index === tile.index;
      const interactive = tile.guessable && daVinciCan(view, "guess_tile");
      const el = document.createElement(interactive ? "button" : "div");
      el.className = "davinci-tile";
      if (!tile.face_visible) el.classList.add("unknown");
      if (tile.face_visible && tile.color === "dark") el.classList.add("dark");
      if (tile.face_visible && tile.color === "light") el.classList.add("light");
      if (tile.revealed) el.classList.add("revealed");
      if (interactive) {
        el.type = "button";
        el.classList.add("guessable");
        el.addEventListener("click", () => toggleDaVinciTarget(player.player_id, tile.index));
      }
      if (isTarget) {
        el.classList.add("is-target");
      }
      el.textContent = tile.label || "-";
      rack.appendChild(el);
    });
    if (!(player.tiles || []).length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No tiles.";
      rack.appendChild(empty);
    }
    card.appendChild(rack);

    const pending = document.createElement("div");
    pending.className = "davinci-pending-line";
    if (player.pending_tile && player.pending_tile.exists) {
      pending.textContent = player.pending_tile.face_visible
        ? `Drawn tile: ${player.pending_tile.label}`
        : "Drawn tile: hidden";
    } else {
      pending.textContent = "Drawn tile: none";
    }
    card.appendChild(pending);

    davinciCodeTable.appendChild(card);
  });
}

function renderDaVinciCodeControls(view) {
  if (!davinciCodeControls) return;
  davinciCodeControls.innerHTML = "";
  const selfPlayer = daVinciFindSelf(view);
  if (davinciCodePending) {
    if (selfPlayer && selfPlayer.pending_tile && selfPlayer.pending_tile.exists) {
      davinciCodePending.textContent = selfPlayer.pending_tile.face_visible
        ? `Your drawn tile: ${selfPlayer.pending_tile.label}`
        : "Your drawn tile: hidden";
    } else {
      davinciCodePending.textContent = "Your drawn tile: none";
    }
  }

  if (daVinciCan(view, "continue_guess")) {
    const continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "davinci-option-btn";
    continueBtn.textContent = "Continue Guessing";
    continueBtn.addEventListener("click", () => sendAction({ type: "continue_guess" }));
    davinciCodeControls.appendChild(continueBtn);

    const stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "davinci-option-btn";
    stopBtn.textContent = "Stop";
    stopBtn.addEventListener("click", () => sendAction({ type: "stop_turn" }));
    davinciCodeControls.appendChild(stopBtn);
    return;
  }

  if (daVinciCan(view, "reveal_own_tile")) {
    (view.reveal_options || []).forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "davinci-option-btn";
      btn.textContent = `Reveal #${option.tile_index + 1} · ${option.label}`;
      btn.addEventListener("click", () => sendAction({ type: "reveal_own_tile", tile_index: option.tile_index }));
      davinciCodeControls.appendChild(btn);
    });
    return;
  }

  if (daVinciCan(view, "insert_pending_tile")) {
    (view.pending_insert_options || []).forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "davinci-option-btn";
      btn.textContent = option.preview || `Insert at #${option.insert_index + 1}`;
      btn.addEventListener("click", () => sendAction({ type: "insert_pending_tile", insert_index: option.insert_index }));
      davinciCodeControls.appendChild(btn);
    });
    return;
  }

  if (view.phase_detail) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = view.phase_detail;
    davinciCodeControls.appendChild(hint);
  }
}

function renderDaVinciCodeLog(view) {
  if (!davinciCodeLog) return;
  davinciCodeLog.innerHTML = "";
  const entries = Array.isArray(view.public_log) ? view.public_log : [];
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No log yet.";
    davinciCodeLog.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `davinci-log-entry kind-${entry.kind || "info"}`;
    row.textContent = entry.message || "-";
    davinciCodeLog.appendChild(row);
  });
}

function renderDaVinciCodeGameState(data) {
  const view = data && data.view ? data.view : null;
  currentDaVinciCodeView = view;
  if (!view) {
    clearDaVinciCodeState();
    return;
  }
  if (!daVinciCan(view, "guess_tile")) {
    daVinciSelectedTarget = null;
  } else if (daVinciSelectedTarget) {
    const targetPlayer = (view.players || []).find((player) => player.player_id === daVinciSelectedTarget.playerId);
    const stillValid = !!targetPlayer
      && Array.isArray(targetPlayer.tiles)
      && targetPlayer.tiles.some((tile) => tile.index === daVinciSelectedTarget.index && tile.guessable);
    if (!stillValid) {
      daVinciSelectedTarget = null;
    }
  }

  if (davinciCodePhaseLabel) davinciCodePhaseLabel.textContent = view.phase || "-";
  if (davinciCodeModeLabel) davinciCodeModeLabel.textContent = view.mode || "-";
  if (davinciCodeTurnLabel) davinciCodeTurnLabel.textContent = view.current_turn_name || "-";
  if (davinciCodeDeckLabel) davinciCodeDeckLabel.textContent = String(view.draw_pile_count ?? "-");
  if (davinciCodeDetailLabel) davinciCodeDetailLabel.textContent = view.phase_detail || "-";
  if (davinciCodeWinnersLabel) {
    const winners = Array.isArray(view.winner_names) ? view.winner_names : [];
    davinciCodeWinnersLabel.textContent = winners.length ? winners.join(", ") : "-";
  }
  if (davinciCodeGuessTarget) {
    davinciCodeGuessTarget.textContent = daVinciSelectedTargetLabel();
  }

  populateDaVinciGuessValueOptions(view);
  renderDaVinciCodeSetup(view);
  renderDaVinciCodeTable(view);
  renderDaVinciCodeControls(view);
  renderDaVinciCodeLog(view);
  updateDaVinciGuessButton();
}

if (davinciCodeGuessBtn) {
  davinciCodeGuessBtn.addEventListener("click", () => {
    if (!currentDaVinciCodeView || !daVinciSelectedTarget) return;
    const declaredColor = davinciCodeGuessColor ? davinciCodeGuessColor.value || "dark" : "dark";
    const rawValue = davinciCodeGuessValue ? davinciCodeGuessValue.value : "0";
    const declaredValue = rawValue === "dash" ? "dash" : Number.parseInt(rawValue, 10);
    sendAction({
      type: "guess_tile",
      target_player_id: daVinciSelectedTarget.playerId,
      target_index: daVinciSelectedTarget.index,
      declared_color: declaredColor,
      declared_value: declaredValue,
    });
  });
}

if (davinciCodeGuessColor) {
  davinciCodeGuessColor.addEventListener("change", updateDaVinciGuessButton);
}

if (davinciCodeGuessValue) {
  davinciCodeGuessValue.addEventListener("change", updateDaVinciGuessButton);
}

if (davinciCodeHelpBtn) {
  davinciCodeHelpBtn.addEventListener("click", openDaVinciCodeHelpModal);
}

if (davinciCodeExplainBtn) {
  davinciCodeExplainBtn.addEventListener("click", openDaVinciCodeExplainModal);
}

if (davinciCodeHelpModalCloseBtn) {
  davinciCodeHelpModalCloseBtn.addEventListener("click", () => {
    if (davinciCodeHelpModal) setModalVisible(davinciCodeHelpModal, false);
  });
}

if (davinciCodeExplainModalCloseBtn) {
  davinciCodeExplainModalCloseBtn.addEventListener("click", () => {
    if (davinciCodeExplainModal) setModalVisible(davinciCodeExplainModal, false);
  });
}

if (davinciCodeHelpModal) {
  davinciCodeHelpModal.addEventListener("click", (event) => {
    if (event.target === davinciCodeHelpModal) {
      setModalVisible(davinciCodeHelpModal, false);
    }
  });
}

if (davinciCodeExplainModal) {
  davinciCodeExplainModal.addEventListener("click", (event) => {
    if (event.target === davinciCodeExplainModal) {
      setModalVisible(davinciCodeExplainModal, false);
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (davinciCodeHelpModal && !davinciCodeHelpModal.classList.contains("hidden")) {
    setModalVisible(davinciCodeHelpModal, false);
  }
  if (davinciCodeExplainModal && !davinciCodeExplainModal.classList.contains("hidden")) {
    setModalVisible(davinciCodeExplainModal, false);
  }
});
