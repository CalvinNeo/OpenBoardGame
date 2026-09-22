let currentDaVinciCodeView = null;
let daVinciSelectedTarget = null;
let daVinciExplainMode = false;
let daVinciExplainBlockClick = false;
let daVinciTipTimer = null;
let daVinciTipTarget = null;

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
const davinciCodeGuessPalette = document.getElementById("davinciCodeGuessPalette");
const davinciCodePending = document.getElementById("davinciCodePending");
const davinciCodeControls = document.getElementById("davinciCodeControls");
const davinciCodeLog = document.getElementById("davinciCodeLog");

const DAVINCI_HELP_HTML = `
  <h3>Goal</h3>
  <p>Be the last player with at least one hidden tile in your code row.</p>

  <h3>Turn Flow</h3>
  <ol>
    <li>At the start of your turn you draw one tile. Only you can see its face.</li>
    <li>Click one hidden opponent tile, then click a tile in the Dark (⚫) or Light (⚪) palette to submit that exact guess.</li>
    <li>If you are correct, that opponent tile is revealed and you may continue or stop.</li>
    <li>If you stop, your drawn tile is inserted hidden. If you miss, your drawn tile is inserted revealed.</li>
  </ol>

  <h3>Row Order</h3>
  <p>Number tiles always stay in ascending order from left to right. If two tiles show the same number, Dark (⚫) stays left of Light (⚪).</p>

  <h3>Choosing a Tile</h3>
  <p>Both colors show every number from 0–11. Advanced mode also shows Dash (━) for each color. Clicking a palette tile immediately submits the guess; select a target first. Click the selected target again, click blank space, or press Esc to cancel the target selection.</p>
  <p>Hidden opponent tiles show their position (#) in the row. Hover over tiles for a short description, or tap on mobile. Use Explain, then click a highlighted control to read what it does without taking an action.</p>

  <h3>Empty Deck</h3>
  <p>When the draw pile runs out, wrong guesses no longer reveal a drawn tile. Instead, you must reveal one of your own hidden tiles.</p>

  <h3>Advanced Mode</h3>
  <ul>
    <li>Two Dash (━) tiles are added to the deck, one Dark (⚫) and one Light (⚪).</li>
    <li>Players who start with a Dash (━) tile must choose its initial position before the game begins.</li>
    <li>Whenever a Dash (━) is involved, choose from the legal insertion positions shown.</li>
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
  setDaVinciExplainMode(false);
  hideDaVinciTip();
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
  if (davinciCodeGuessPalette) davinciCodeGuessPalette.innerHTML = "";
  if (davinciCodeHelpModal) setModalVisible(davinciCodeHelpModal, false);
  if (davinciCodeExplainModal) setModalVisible(davinciCodeExplainModal, false);
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
  renderDaVinciGuessPalette({ mode });

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

  updateDaVinciGuessPalette();
}

function showDaVinciCodeHeaderActions(show) {
  if (!davinciCodeHeaderActions) return;
  davinciCodeHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    setDaVinciExplainMode(false);
    hideDaVinciTip();
    if (davinciCodeHelpModal) setModalVisible(davinciCodeHelpModal, false);
    if (davinciCodeExplainModal) setModalVisible(davinciCodeExplainModal, false);
  }
}

function openDaVinciCodeHelpModal() {
  if (!davinciCodeHelpContent || !davinciCodeHelpModal) return;
  setDaVinciExplainMode(false);
  hideDaVinciTip();
  davinciCodeHelpContent.innerHTML = DAVINCI_HELP_HTML;
  setModalVisible(davinciCodeHelpModal, true);
}

function daVinciDescribe(element, text) {
  element.dataset.davinciTip = text;
}

function setDaVinciExplainMode(enabled) {
  daVinciExplainMode = enabled;
  document.body.classList.toggle("davinci-explain-mode", enabled);
  if (davinciCodeExplainBtn) {
    davinciCodeExplainBtn.classList.toggle("active", enabled);
    davinciCodeExplainBtn.setAttribute("aria-pressed", String(enabled));
  }
  hideDaVinciTip();
}

function openDaVinciCodeExplainModal(button) {
  if (!davinciCodeExplainContent || !davinciCodeExplainModal) return;
  const description = document.createElement("p");
  description.textContent = button.dataset.davinciTip;
  davinciCodeExplainContent.replaceChildren(description);
  setDaVinciExplainMode(false);
  setModalVisible(davinciCodeExplainModal, true);
}

function hideDaVinciTip() {
  window.clearTimeout(daVinciTipTimer);
  daVinciTipTimer = null;
  if (daVinciTipTarget) daVinciTipTarget.removeAttribute("aria-describedby");
  daVinciTipTarget = null;
  const tip = document.getElementById("davinciCodeTip");
  if (tip) tip.hidden = true;
}

function showDaVinciTip(target, timed = false) {
  if (daVinciExplainMode || !target.dataset.davinciTip) return;
  hideDaVinciTip();
  let tip = document.getElementById("davinciCodeTip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "davinciCodeTip";
    tip.className = "davinci-tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }
  tip.textContent = target.dataset.davinciTip;
  tip.hidden = false;
  daVinciTipTarget = target;
  target.setAttribute("aria-describedby", tip.id);
  const rect = target.getBoundingClientRect();
  const box = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(12, Math.min(window.innerWidth - box.width - 12, rect.left))}px`;
  const top = rect.top - box.height - 8;
  tip.style.top = `${Math.max(12, Math.min(window.innerHeight - box.height - 12, top >= 12 ? top : rect.bottom + 8))}px`;
  if (timed) daVinciTipTimer = window.setTimeout(hideDaVinciTip, 3000);
}

function daVinciSelectedTargetLabel() {
  if (currentDaVinciCodeView && !daVinciCan(currentDaVinciCodeView, "guess_tile")) {
    return currentDaVinciCodeView.phase_detail || "Waiting for your turn.";
  }
  if (!currentDaVinciCodeView || !daVinciSelectedTarget) {
    return "Select a hidden opponent tile.";
  }
  const player = (currentDaVinciCodeView.players || []).find((candidate) => candidate.player_id === daVinciSelectedTarget.playerId);
  if (!player) {
    return "Select a hidden opponent tile.";
  }
  return `Target: ${player.name} #${daVinciSelectedTarget.index + 1} · Click a tile below to guess.`;
}

function renderDaVinciGuessPalette(view) {
  if (!davinciCodeGuessPalette) return;
  davinciCodeGuessPalette.replaceChildren();
  const palette = Array.isArray(view.guess_palette) ? view.guess_palette : ["dark", "light"].flatMap((color) => {
    const values = Array.from({ length: 12 }, (_, value) => value);
    if (view.mode === "advanced") values.push("dash");
    return values.map((value) => ({ color, value, is_dash: value === "dash" }));
  });
  ["dark", "light"].forEach((color) => {
    const label = color === "dark" ? "Dark (⚫)" : "Light (⚪)";
    const group = document.createElement("fieldset");
    group.className = "davinci-guess-group";
    const legend = document.createElement("legend");
    legend.textContent = label;
    group.appendChild(legend);
    const tiles = document.createElement("div");
    tiles.className = "davinci-guess-tiles";
    tiles.classList.toggle("has-dash", palette.some((face) => face.color === color && face.is_dash));
    palette.filter((face) => face.color === color).forEach((face) => {
      const value = face.is_dash ? "dash" : face.value;
      const name = `${label} ${value === "dash" ? "Dash (━)" : value}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `davinci-tile davinci-guess-tile ${color}`;
      button.textContent = value === "dash" ? "━" : String(value);
      button.setAttribute("aria-label", `Guess ${name}`);
      daVinciDescribe(button, `${name}. Select a hidden opponent tile, then click here to submit this guess immediately.`);
      button.addEventListener("click", () => submitDaVinciGuess(color, value));
      tiles.appendChild(button);
    });
    group.appendChild(tiles);
    davinciCodeGuessPalette.appendChild(group);
  });
  updateDaVinciGuessPalette();
}

function updateDaVinciGuessPalette() {
  if (!davinciCodeGuessPalette) return;
  const enabled = daVinciCan(currentDaVinciCodeView, "guess_tile") && !!daVinciSelectedTarget;
  davinciCodeGuessPalette.querySelectorAll("button").forEach((button) => {
    button.disabled = !enabled;
  });
}

function clearDaVinciTarget() {
  daVinciSelectedTarget = null;
  if (davinciCodeGuessTarget) davinciCodeGuessTarget.textContent = daVinciSelectedTargetLabel();
  if (davinciCodeTable) {
    davinciCodeTable.querySelectorAll(".is-target").forEach((tile) => {
      tile.classList.remove("is-target");
      tile.setAttribute("aria-pressed", "false");
    });
  }
  updateDaVinciGuessPalette();
}

function submitDaVinciGuess(color, value) {
  if (daVinciExplainMode || !daVinciCan(currentDaVinciCodeView, "guess_tile") || !daVinciSelectedTarget) return;
  const target = daVinciSelectedTarget;
  // Clear immediately so a double click cannot submit a second guess.
  clearDaVinciTarget();
  sendAction({
    type: "guess_tile",
    target_player_id: target.playerId,
    target_index: target.index,
    declared_color: color,
    declared_value: value,
  });
}

function toggleDaVinciTarget(playerId, index, element) {
  if (!currentDaVinciCodeView || !daVinciCan(currentDaVinciCodeView, "guess_tile")) {
    return;
  }
  const wasSelected = daVinciSelectedTarget && daVinciSelectedTarget.playerId === playerId && daVinciSelectedTarget.index === index;
  clearDaVinciTarget();
  if (wasSelected) return;
  daVinciSelectedTarget = { playerId, index };
  element.classList.add("is-target");
  element.setAttribute("aria-pressed", "true");
  if (davinciCodeGuessTarget) {
    davinciCodeGuessTarget.textContent = daVinciSelectedTargetLabel();
  }
  updateDaVinciGuessPalette();
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
    daVinciDescribe(btn, "Start with this row order. Place your Dash (━) while keeping numbers in order, with Dark (⚫) before Light (⚪) on ties.");
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
        el.setAttribute("aria-pressed", String(isTarget));
        el.setAttribute("aria-label", `Select ${player.name}'s hidden tile #${tile.index + 1}`);
        el.addEventListener("click", () => toggleDaVinciTarget(player.player_id, tile.index, el));
      }
      if (isTarget) {
        el.classList.add("is-target");
      }
      el.textContent = tile.label || "-";
      const faceName = tile.face_visible
        ? `${tile.color === "dark" ? "Dark (⚫)" : "Light (⚪)"} ${tile.is_dash ? "Dash (━)" : tile.value}`
        : `Hidden tile #${tile.index + 1}`;
      daVinciDescribe(el, tile.face_visible
        ? `${faceName}. ${tile.revealed ? "Revealed to everyone." : "Only you can see this face."}`
        : `${faceName} in ${player.name}'s row. Select it on your turn, then click a palette tile to guess its color and value.`);
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
    }
    if (pending.textContent) card.appendChild(pending);

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
    daVinciDescribe(continueBtn, "Make another guess this turn. A wrong guess exposes your drawn tile, or one of your hidden tiles if the draw pile is empty.");
    continueBtn.addEventListener("click", () => sendAction({ type: "continue_guess" }));
    davinciCodeControls.appendChild(continueBtn);

    const stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "davinci-option-btn";
    stopBtn.textContent = "Stop";
    daVinciDescribe(stopBtn, "End your turn and add the drawn tile to your row without revealing it.");
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
      daVinciDescribe(btn, `Reveal your tile #${option.tile_index + 1} after a missed guess with an empty draw pile. Dark (⚫), Light (⚪), and Dash (━) identify tile faces.`);
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
      daVinciDescribe(btn, `Insert your drawn tile at position #${option.insert_index + 1}. The preview shows Dark (⚫), Light (⚪), and Dash (━) tiles in their resulting order.`);
      btn.addEventListener("click", () => sendAction({ type: "insert_pending_tile", insert_index: option.insert_index }));
      davinciCodeControls.appendChild(btn);
    });
    return;
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
  if (!daVinciTipTimer) hideDaVinciTip();
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

  renderDaVinciGuessPalette(view);
  renderDaVinciCodeSetup(view);
  renderDaVinciCodeTable(view);
  renderDaVinciCodeControls(view);
  renderDaVinciCodeLog(view);
}

if (davinciCodeModeSelect) {
  davinciCodeModeSelect.addEventListener("change", updateDavinciCodeConfigRow);
}

if (davinciCodeHelpBtn) {
  davinciCodeHelpBtn.addEventListener("click", openDaVinciCodeHelpModal);
}

if (davinciCodeExplainBtn) {
  davinciCodeExplainBtn.setAttribute("aria-pressed", "false");
  davinciCodeExplainBtn.addEventListener("click", () => setDaVinciExplainMode(!daVinciExplainMode));
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

function daVinciExplainExempt(button) {
  return [davinciCodeExplainBtn, davinciCodeHelpBtn, davinciCodeHelpModalCloseBtn, davinciCodeExplainModalCloseBtn].includes(button);
}

document.addEventListener("pointerdown", (event) => {
  daVinciExplainBlockClick = false;
  if (!daVinciExplainMode) return;
  // Hit testing also reaches native disabled buttons in Explain mode.
  const button = event.target.closest("button") || Array.from(davinciCodePanelEl.querySelectorAll("button[data-davinci-tip]")).find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
  });
  if (!button || daVinciExplainExempt(button)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  daVinciExplainBlockClick = true;
  if (button.dataset.davinciTip) openDaVinciCodeExplainModal(button);
}, true);

document.addEventListener("click", (event) => {
  if (daVinciExplainBlockClick && event.detail > 0) {
    daVinciExplainBlockClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (!daVinciExplainMode) return;
  const button = event.target.closest("button");
  if (!button || daVinciExplainExempt(button)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.davinciTip) openDaVinciCodeExplainModal(button);
}, true);

if (davinciCodePanelEl) {
  davinciCodePanelEl.addEventListener("click", (event) => {
    if (daVinciExplainMode || event.target.closest("button, input, select, a, [data-davinci-tip]")) return;
    if (daVinciSelectedTarget) clearDaVinciTarget();
    hideDaVinciTip();
  });
  davinciCodePanelEl.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const target = event.target.closest("[data-davinci-tip]");
    if (target) showDaVinciTip(target);
  });
  davinciCodePanelEl.addEventListener("pointerout", (event) => {
    if (event.pointerType === "mouse" && daVinciTipTarget && !daVinciTipTarget.contains(event.relatedTarget)) hideDaVinciTip();
  });
  davinciCodePanelEl.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") return;
    const target = event.target.closest("[data-davinci-tip]");
    if (target) showDaVinciTip(target, true);
  });
  davinciCodePanelEl.addEventListener("focusin", (event) => {
    if (event.target.matches("[data-davinci-tip]:focus-visible")) showDaVinciTip(event.target);
  });
  davinciCodePanelEl.addEventListener("focusout", () => {
    if (!daVinciTipTimer) hideDaVinciTip();
  });
}

window.addEventListener("resize", hideDaVinciTip);
document.addEventListener("scroll", hideDaVinciTip, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  setDaVinciExplainMode(false);
  hideDaVinciTip();
  if (daVinciSelectedTarget) clearDaVinciTarget();
  if (davinciCodeHelpModal && !davinciCodeHelpModal.classList.contains("hidden")) {
    setModalVisible(davinciCodeHelpModal, false);
  }
  if (davinciCodeExplainModal && !davinciCodeExplainModal.classList.contains("hidden")) {
    setModalVisible(davinciCodeExplainModal, false);
  }
});
