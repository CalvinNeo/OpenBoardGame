let currentWavelengthView = null;
let wavelengthExplainMode = false;

const wavelengthHeaderActions = document.getElementById("wavelengthHeaderActions");
const wavelengthHelpBtn = document.getElementById("wavelengthHelpBtn");
const wavelengthExplainBtn = document.getElementById("wavelengthExplainBtn");
const wavelengthHelpModal = document.getElementById("wavelengthHelpModal");
const wavelengthHelpModalCloseBtn = document.getElementById("wavelengthHelpModalCloseBtn");
const wavelengthHelpContent = document.getElementById("wavelengthHelpContent");
const wavelengthExplainModal = document.getElementById("wavelengthExplainModal");
const wavelengthExplainModalCloseBtn = document.getElementById("wavelengthExplainModalCloseBtn");
const wavelengthExplainContent = document.getElementById("wavelengthExplainContent");

const wavelengthPhaseLabel = document.getElementById("wavelengthPhase");
const wavelengthRoundLabel = document.getElementById("wavelengthRound");
const wavelengthYourTeamLabel = document.getElementById("wavelengthYourTeam");
const wavelengthYourRoleLabel = document.getElementById("wavelengthYourRole");
const wavelengthScoresLabel = document.getElementById("wavelengthScores");
const wavelengthCardLabel = document.getElementById("wavelengthCard");
const wavelengthClueLabel = document.getElementById("wavelengthClue");
const wavelengthTargetLabel = document.getElementById("wavelengthTarget");
const wavelengthStatusBody = document.getElementById("wavelengthStatusBody");
const wavelengthTrackTarget = document.getElementById("wavelengthTrackTarget");
const wavelengthTrackGuess = document.getElementById("wavelengthTrackGuess");
const wavelengthZone2 = document.getElementById("wavelengthZone2");
const wavelengthZone3 = document.getElementById("wavelengthZone3");
const wavelengthZone4 = document.getElementById("wavelengthZone4");
const wavelengthTrack = document.querySelector("#wavelengthPanel .wavelength-track");
const wavelengthPlayers = document.getElementById("wavelengthPlayers");
const wavelengthHistory = document.getElementById("wavelengthHistory");

const wavelengthClueInput = document.getElementById("wavelengthClueInput");
const wavelengthSubmitClueBtn = document.getElementById("wavelengthSubmitClueBtn");
const wavelengthGuessValue = document.getElementById("wavelengthGuessValue");
const wavelengthSubmitGuessBtn = document.getElementById("wavelengthSubmitGuessBtn");
const wavelengthSideLeftBtn = document.getElementById("wavelengthSideLeftBtn");
const wavelengthSideRightBtn = document.getElementById("wavelengthSideRightBtn");
let wavelengthTrackDragging = false;
let wavelengthEditableGuessPos = 0;
const WAVELENGTH_SCORE_BANDS = [
  { halfWidth: 0.38, el: wavelengthZone2 },
  { halfWidth: 0.24, el: wavelengthZone3 },
  { halfWidth: 0.12, el: wavelengthZone4 },
];

const WAVELENGTH_HELP_HTML = `
  <h3>Goal</h3>
  <p>Your team tries to place the dial near the hidden target 🎯 on a spectrum between two concepts.</p>
  <h3>Round Flow</h3>
  <ol>
    <li><strong>Psychic</strong> sees the hidden target and gives one clue.</li>
    <li><strong>Team</strong> sets one dial position on the spectrum.</li>
    <li><strong>Opponents</strong> guess if the real target is on the left ⬅️ or right ➡️ of your dial.</li>
    <li>Reveal and score.</li>
  </ol>
  <h3>Scoring</h3>
  <ul>
    <li>Closer dial gives your team 2 / 3 / 4 points.</li>
    <li>Opponent gets 1 point if side guess is correct.</li>
    <li>If your team hits the 4-point center zone, opponents get 0 this round.</li>
  </ul>
`;

const WAVELENGTH_EXPLAIN = {
  wavelengthSubmitClueBtn: "Send one clue as the psychic. Keep it short and clear.",
  wavelengthSubmitGuessBtn: "Lock your team's final dial position on the spectrum.",
  wavelengthSideLeftBtn: "Opponent prediction: hidden target is left of your dial.",
  wavelengthSideRightBtn: "Opponent prediction: hidden target is right of your dial.",
};

const wavelengthActionButtons = {
  submit_clue: wavelengthSubmitClueBtn,
  submit_team_guess: wavelengthSubmitGuessBtn,
  submit_side_guess_left: wavelengthSideLeftBtn,
  submit_side_guess_right: wavelengthSideRightBtn,
};

[wavelengthSubmitClueBtn, wavelengthSubmitGuessBtn, wavelengthSideLeftBtn, wavelengthSideRightBtn].forEach((button) => {
  if (button) {
    button.classList.add("has-explanation");
  }
});

function wavelengthCan(actionType) {
  return Array.isArray(currentWavelengthView && currentWavelengthView.legal_actions)
    && currentWavelengthView.legal_actions.includes(actionType);
}

function formatWavelengthTeam(teamId) {
  if (teamId === "A") return "🔵 Team A";
  if (teamId === "B") return "🟠 Team B";
  return "-";
}

function setWavelengthMarker(marker, pos) {
  if (!marker) return;
  if (typeof pos !== "number" || Number.isNaN(pos)) {
    marker.classList.add("hidden");
    return;
  }
  const clamped = Math.max(-1, Math.min(1, pos));
  const rawPercent = ((clamped + 1) / 2) * 100;
  const percent = Math.max(2, Math.min(98, rawPercent));
  marker.style.left = `${percent}%`;
  marker.classList.remove("hidden");
}

function wavelengthPosFromClientX(clientX) {
  if (!wavelengthTrack) {
    return 0;
  }
  const rect = wavelengthTrack.getBoundingClientRect();
  if (!rect.width) {
    return 0;
  }
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return ratio * 2 - 1;
}

function setWavelengthEditableGuess(pos) {
  const clamped = Math.max(-1, Math.min(1, Number(pos) || 0));
  wavelengthEditableGuessPos = clamped;
  if (wavelengthGuessValue) {
    wavelengthGuessValue.textContent = clamped.toFixed(2);
  }
  setWavelengthMarker(wavelengthTrackGuess, clamped);
}

function setWavelengthZone(zoneEl, center, halfWidth) {
  if (!zoneEl) return;
  if (typeof center !== "number" || Number.isNaN(center)) {
    zoneEl.classList.add("hidden");
    return;
  }
  const leftRatio = Math.max(0, (center - halfWidth + 1) / 2);
  const rightRatio = Math.min(1, (center + halfWidth + 1) / 2);
  const widthRatio = Math.max(0, rightRatio - leftRatio);
  zoneEl.style.left = `${leftRatio * 100}%`;
  zoneEl.style.width = `${widthRatio * 100}%`;
  zoneEl.classList.remove("hidden");
}

function setWavelengthZones(center) {
  WAVELENGTH_SCORE_BANDS.forEach((band) => {
    setWavelengthZone(band.el, center, band.halfWidth);
  });
}

function renderWavelengthPlayers(view) {
  if (!wavelengthPlayers) return;
  wavelengthPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const row = document.createElement("div");
    row.className = "wavelength-player-row";
    const role = player.is_psychic ? " (Psychic)" : "";
    row.textContent = `${formatWavelengthTeam(player.team_id)} · ${player.name}${role}`;
    wavelengthPlayers.appendChild(row);
  });
}

function renderWavelengthHistory(view) {
  if (!wavelengthHistory) return;
  wavelengthHistory.innerHTML = "";
  const last = view.last_round_summary;
  if (last) {
    const card = last.card || {};
    const row = document.createElement("div");
    row.className = "wavelength-history-row";
    row.textContent = `R${last.round_number} · ${formatWavelengthTeam(last.active_team)} clue "${last.clue_text}" · `
      + `${card.left_label || "左侧"} ↔ ${card.right_label || "右侧"} · `
      + `+${last.active_points} / +${last.opponent_points}`;
    wavelengthHistory.appendChild(row);
  } else {
    wavelengthHistory.textContent = "No resolved round yet.";
  }
}

function updateWavelengthStatus(view) {
  if (!wavelengthStatusBody) return;
  if (!view) {
    wavelengthStatusBody.textContent = "-";
    return;
  }
  if (view.game_over) {
    wavelengthStatusBody.textContent = `Game over. Winner: ${formatWavelengthTeam(view.winner)}.`;
    return;
  }
  if (wavelengthCan("submit_clue")) {
    wavelengthStatusBody.textContent = "You are the psychic. Enter one clue.";
    return;
  }
  if (wavelengthCan("submit_team_guess")) {
    wavelengthStatusBody.textContent = "Set your team dial and submit.";
    return;
  }
  if (wavelengthCan("submit_side_guess")) {
    wavelengthStatusBody.textContent = "Choose LEFT or RIGHT against their dial.";
    return;
  }
  wavelengthStatusBody.textContent = "Waiting for other players.";
}

function updateWavelengthActionButtons() {
  Object.entries(wavelengthActionButtons).forEach(([key, button]) => {
    if (!button) return;
    let allowed = false;
    if (key === "submit_side_guess_left" || key === "submit_side_guess_right") {
      allowed = wavelengthCan("submit_side_guess");
    } else {
      allowed = wavelengthCan(key);
    }
    if (key === "submit_clue" && allowed) {
      const text = wavelengthClueInput ? wavelengthClueInput.value.trim() : "";
      allowed = text.length > 0;
    }
    if (allowed) button.classList.add("action-allowed");
    else button.classList.remove("action-allowed");
    button.disabled = !allowed;
  });
  if (wavelengthTrack) {
    wavelengthTrack.classList.toggle("is-draggable", wavelengthCan("submit_team_guess"));
  }
}

function clearWavelengthState() {
  currentWavelengthView = null;
  if (wavelengthPhaseLabel) wavelengthPhaseLabel.textContent = "-";
  if (wavelengthRoundLabel) wavelengthRoundLabel.textContent = "-";
  if (wavelengthYourTeamLabel) wavelengthYourTeamLabel.textContent = "-";
  if (wavelengthYourRoleLabel) wavelengthYourRoleLabel.textContent = "-";
  if (wavelengthScoresLabel) wavelengthScoresLabel.textContent = "-";
  if (wavelengthCardLabel) wavelengthCardLabel.textContent = "-";
  if (wavelengthClueLabel) wavelengthClueLabel.textContent = "-";
  if (wavelengthTargetLabel) wavelengthTargetLabel.textContent = "Hidden";
  if (wavelengthPlayers) wavelengthPlayers.innerHTML = "";
  if (wavelengthHistory) wavelengthHistory.innerHTML = "";
  if (wavelengthGuessValue) wavelengthGuessValue.textContent = "0.00";
  if (wavelengthClueInput) wavelengthClueInput.value = "";
  wavelengthEditableGuessPos = 0;
  setWavelengthZones(null);
  setWavelengthMarker(wavelengthTrackTarget, null);
  setWavelengthMarker(wavelengthTrackGuess, null);
  updateWavelengthStatus(null);
  updateWavelengthActionButtons();
}

function renderWavelengthGameState(data) {
  const view = data.view || {};
  currentWavelengthView = view;
  if (currentGameType !== "wavelength") {
    currentGameType = "wavelength";
    setGamePanelVisibility("wavelength");
  }
  const scores = view.scores || {};
  const card = view.spectrum_card || {};
  if (wavelengthPhaseLabel) wavelengthPhaseLabel.textContent = view.phase || "-";
  if (wavelengthRoundLabel) wavelengthRoundLabel.textContent = view.round ?? "-";
  if (wavelengthYourTeamLabel) wavelengthYourTeamLabel.textContent = formatWavelengthTeam(view.your_team);
  if (wavelengthYourRoleLabel) wavelengthYourRoleLabel.textContent = view.your_role || "-";
  if (wavelengthScoresLabel) wavelengthScoresLabel.textContent = `🔵 ${scores.A ?? 0} : 🟠 ${scores.B ?? 0} (target ${view.target_score ?? "-"})`;
  if (wavelengthCardLabel) wavelengthCardLabel.textContent = `${card.left_label || "左侧"} ↔ ${card.right_label || "右侧"}`;
  if (wavelengthClueLabel) wavelengthClueLabel.textContent = view.clue_text || "(no clue yet)";
  if (wavelengthTargetLabel) {
    wavelengthTargetLabel.textContent = typeof view.target_center === "number"
      ? view.target_center.toFixed(2)
      : "Hidden";
  }
  setWavelengthZones(view.target_center);
  setWavelengthMarker(wavelengthTrackTarget, view.target_center);
  setWavelengthMarker(wavelengthTrackGuess, view.team_guess_pos);
  if (typeof view.team_guess_pos === "number" && !Number.isNaN(view.team_guess_pos)) {
    setWavelengthEditableGuess(view.team_guess_pos);
  } else if (!wavelengthCan("submit_team_guess")) {
    setWavelengthEditableGuess(0);
  }
  renderWavelengthPlayers(view);
  renderWavelengthHistory(view);
  updateWavelengthStatus(view);
  updateWavelengthActionButtons();
}

function showWavelengthHelpModal() {
  if (!wavelengthHelpModal) return;
  if (wavelengthHelpContent) wavelengthHelpContent.innerHTML = WAVELENGTH_HELP_HTML;
  setModalVisible(wavelengthHelpModal, true);
}

function closeWavelengthHelpModal() {
  if (wavelengthHelpModal) setModalVisible(wavelengthHelpModal, false);
}

function showWavelengthHeaderActions(show) {
  if (wavelengthHeaderActions) wavelengthHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    wavelengthExplainMode = false;
    document.body.classList.remove("wavelength-explain-mode");
    if (wavelengthExplainBtn) wavelengthExplainBtn.classList.remove("active");
    closeWavelengthHelpModal();
    if (wavelengthExplainModal) setModalVisible(wavelengthExplainModal, false);
  }
}

function showWavelengthButtonExplanation(buttonId) {
  if (!wavelengthExplainModal || !wavelengthExplainContent) return;
  const text = WAVELENGTH_EXPLAIN[buttonId];
  if (!text) return;
  wavelengthExplainContent.innerHTML = `<p>${text}</p>`;
  setModalVisible(wavelengthExplainModal, true);
}

if (wavelengthHelpBtn) wavelengthHelpBtn.addEventListener("click", showWavelengthHelpModal);
if (wavelengthHelpModalCloseBtn) wavelengthHelpModalCloseBtn.addEventListener("click", closeWavelengthHelpModal);
if (wavelengthExplainBtn) {
  wavelengthExplainBtn.addEventListener("click", () => {
    wavelengthExplainMode = !wavelengthExplainMode;
    document.body.classList.toggle("wavelength-explain-mode", wavelengthExplainMode);
    wavelengthExplainBtn.classList.toggle("active", wavelengthExplainMode);
  });
}
if (wavelengthExplainModalCloseBtn) {
  wavelengthExplainModalCloseBtn.addEventListener("click", () => setModalVisible(wavelengthExplainModal, false));
}

if (wavelengthClueInput) wavelengthClueInput.addEventListener("input", updateWavelengthActionButtons);

if (wavelengthTrack) {
  wavelengthTrack.addEventListener("pointerdown", (e) => {
    if (wavelengthExplainMode || !wavelengthCan("submit_team_guess")) {
      return;
    }
    wavelengthTrackDragging = true;
    wavelengthTrack.setPointerCapture(e.pointerId);
    setWavelengthEditableGuess(wavelengthPosFromClientX(e.clientX));
    updateWavelengthActionButtons();
    e.preventDefault();
  });
  wavelengthTrack.addEventListener("pointermove", (e) => {
    if (!wavelengthTrackDragging) {
      return;
    }
    setWavelengthEditableGuess(wavelengthPosFromClientX(e.clientX));
    updateWavelengthActionButtons();
    e.preventDefault();
  });
  wavelengthTrack.addEventListener("pointerup", (e) => {
    if (!wavelengthTrackDragging) {
      return;
    }
    wavelengthTrackDragging = false;
    wavelengthTrack.releasePointerCapture(e.pointerId);
  });
  wavelengthTrack.addEventListener("pointercancel", (e) => {
    wavelengthTrackDragging = false;
    if (wavelengthTrack.hasPointerCapture(e.pointerId)) {
      wavelengthTrack.releasePointerCapture(e.pointerId);
    }
  });
}

if (wavelengthSubmitClueBtn) {
  wavelengthSubmitClueBtn.addEventListener("click", () => {
    if (!wavelengthCan("submit_clue")) return;
    const clue = wavelengthClueInput ? wavelengthClueInput.value.trim() : "";
    if (!clue) return;
    sendAction({ type: "submit_clue", clue });
  });
}

if (wavelengthSubmitGuessBtn) {
  wavelengthSubmitGuessBtn.addEventListener("click", () => {
    if (!wavelengthCan("submit_team_guess")) return;
    sendAction({ type: "submit_team_guess", pos: wavelengthEditableGuessPos });
  });
}

if (wavelengthSideLeftBtn) {
  wavelengthSideLeftBtn.addEventListener("click", () => {
    if (!wavelengthCan("submit_side_guess")) return;
    sendAction({ type: "submit_side_guess", side: "LEFT" });
  });
}

if (wavelengthSideRightBtn) {
  wavelengthSideRightBtn.addEventListener("click", () => {
    if (!wavelengthCan("submit_side_guess")) return;
    sendAction({ type: "submit_side_guess", side: "RIGHT" });
  });
}

document.addEventListener("pointerdown", (e) => {
  if (!wavelengthExplainMode) return;
  const button = e.target.closest("button");
  if (!button) {
    wavelengthExplainMode = false;
    document.body.classList.remove("wavelength-explain-mode");
    if (wavelengthExplainBtn) wavelengthExplainBtn.classList.remove("active");
    return;
  }
  const buttonId = button.id || "";
  if (buttonId in WAVELENGTH_EXPLAIN) {
    e.preventDefault();
    e.stopPropagation();
    showWavelengthButtonExplanation(buttonId);
    wavelengthExplainMode = false;
    document.body.classList.remove("wavelength-explain-mode");
    if (wavelengthExplainBtn) wavelengthExplainBtn.classList.remove("active");
  }
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && wavelengthExplainMode) {
    wavelengthExplainMode = false;
    document.body.classList.remove("wavelength-explain-mode");
    if (wavelengthExplainBtn) wavelengthExplainBtn.classList.remove("active");
  }
});
