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
const wavelengthSpectrumCard = document.getElementById("wavelengthSpectrumCard");
const wavelengthCardLabel = document.getElementById("wavelengthCard");
const wavelengthClueInfoCard = document.getElementById("wavelengthClueInfoCard");
const wavelengthClueLabel = document.getElementById("wavelengthClue");
const wavelengthTargetInfoCard = document.getElementById("wavelengthTargetInfoCard");
const wavelengthTargetLabel = document.getElementById("wavelengthTarget");
const wavelengthStatusBody = document.getElementById("wavelengthStatusBody");
const wavelengthTrackTarget = document.getElementById("wavelengthTrackTarget");
const wavelengthTrackGuess = document.getElementById("wavelengthTrackGuess");
const wavelengthZone2 = document.getElementById("wavelengthZone2");
const wavelengthZone3 = document.getElementById("wavelengthZone3");
const wavelengthZone4 = document.getElementById("wavelengthZone4");
const wavelengthLabel2 = document.getElementById("wavelengthLabel2");
const wavelengthLabel3 = document.getElementById("wavelengthLabel3");
const wavelengthLabel4 = document.getElementById("wavelengthLabel4");
const wavelengthTrack = document.querySelector("#wavelengthPanel .wavelength-track");
const wavelengthPlayers = document.getElementById("wavelengthPlayers");
const wavelengthHistory = document.getElementById("wavelengthHistory");

const wavelengthClueInput = document.getElementById("wavelengthClueInput");
const wavelengthClueCard = document.getElementById("wavelengthClueCard");
const wavelengthClueCardCopy = document.getElementById("wavelengthClueCardCopy");
const wavelengthSubmitClueBtn = document.getElementById("wavelengthSubmitClueBtn");
const wavelengthGuessCard = document.getElementById("wavelengthGuessCard");
const wavelengthGuessCardCopy = document.getElementById("wavelengthGuessCardCopy");
const wavelengthGuessValue = document.getElementById("wavelengthGuessValue");
const wavelengthSubmitGuessBtn = document.getElementById("wavelengthSubmitGuessBtn");
const wavelengthSideCard = document.getElementById("wavelengthSideCard");
const wavelengthSideCardCopy = document.getElementById("wavelengthSideCardCopy");
const wavelengthSideLeftBtn = document.getElementById("wavelengthSideLeftBtn");
const wavelengthSideRightBtn = document.getElementById("wavelengthSideRightBtn");
const wavelengthContinueCard = document.getElementById("wavelengthContinueCard");
const wavelengthContinueCardCopy = document.getElementById("wavelengthContinueCardCopy");
const wavelengthContinueBtn = document.getElementById("wavelengthContinueBtn");
let wavelengthTrackDragging = false;
let wavelengthEditableGuessPos = 0;
const WAVELENGTH_SCORE_BANDS = [
  { halfWidth: 0.38, el: wavelengthZone2, labelEl: wavelengthLabel2 },
  { halfWidth: 0.24, el: wavelengthZone3, labelEl: wavelengthLabel3 },
  { halfWidth: 0.12, el: wavelengthZone4, labelEl: wavelengthLabel4 },
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
  wavelengthContinueBtn: "After recap, continue to the next round.",
};

const wavelengthExplainTargets = {
  wavelengthSpectrumCard: () => {
    const card = (currentWavelengthView && currentWavelengthView.spectrum_card) || {};
    const left = card.left_label || "左侧";
    const right = card.right_label || "右侧";
    return {
      title: "Spectrum",
      body: `This round's scale runs from ${left} on the left to ${right} on the right. The psychic sees the hidden target somewhere on this line and should give one clue that helps teammates aim near that spot.`,
    };
  },
  wavelengthClueInfoCard: () => {
    const clue = (currentWavelengthView && currentWavelengthView.clue_text) || "";
    return {
      title: "Clue",
      body: clue
        ? `This is the psychic's one clue for the current spectrum. Teammates should interpret it relative to the left and right ends, then place the dial. Current clue: ${clue}`
        : "This is where the psychic's one clue will appear. Until a clue is submitted, teammates should wait here for guidance.",
    };
  },
  wavelengthTargetInfoCard: () => {
    const targetVisible = currentWavelengthView && typeof currentWavelengthView.target_center === "number";
    return {
      title: "Target",
      body: targetVisible
        ? "This is the true hidden target position on the spectrum. Closer guesses score more: within 0.12 is 4 points, within 0.24 is 3 points, and within 0.38 is 2 points."
        : "This shows the hidden target position. Most players should not see it before reveal. Usually only the psychic, or everyone after the round ends, can view the true target.",
    };
  },
};

const wavelengthActionButtons = {
  submit_clue: wavelengthSubmitClueBtn,
  submit_team_guess: wavelengthSubmitGuessBtn,
  submit_side_guess_left: wavelengthSideLeftBtn,
  submit_side_guess_right: wavelengthSideRightBtn,
  continue_next_round: wavelengthContinueBtn,
};

[wavelengthSubmitClueBtn, wavelengthSubmitGuessBtn, wavelengthSideLeftBtn, wavelengthSideRightBtn, wavelengthContinueBtn].forEach((button) => {
  if (button) {
    button.classList.add("has-explanation");
  }
});

[wavelengthSpectrumCard, wavelengthClueInfoCard, wavelengthTargetInfoCard].forEach((card) => {
  if (card) {
    card.classList.add("has-explanation");
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
    const side = clamped < 0 ? "Left" : clamped > 0 ? "Right" : "Center";
    wavelengthGuessValue.textContent = `${side} ${clamped.toFixed(2)}`;
  }
  setWavelengthMarker(wavelengthTrackGuess, clamped);
}

function setWavelengthActionCardState(card, active) {
  if (!card) return;
  card.classList.toggle("is-active", active);
  card.classList.toggle("is-blocked", !active);
}

function updateWavelengthActionCards(view) {
  const yourTeam = formatWavelengthTeam(view && view.your_team);
  const activeTeam = formatWavelengthTeam(view && view.active_team);
  const opponentTeam = formatWavelengthTeam(view && view.opponent_team);
  const canClue = wavelengthCan("submit_clue");
  const canGuess = wavelengthCan("submit_team_guess");
  const canSide = wavelengthCan("submit_side_guess");
  const canContinue = wavelengthCan("continue_next_round");

  setWavelengthActionCardState(wavelengthClueCard, canClue);
  setWavelengthActionCardState(wavelengthGuessCard, canGuess);
  setWavelengthActionCardState(wavelengthSideCard, canSide);
  setWavelengthActionCardState(wavelengthContinueCard, canContinue);

  if (wavelengthClueCardCopy) {
    wavelengthClueCardCopy.textContent = !view
      ? "Only the psychic types one clue for the active team."
      : canClue
        ? `You are the psychic for ${activeTeam}. Enter one clue now.`
        : `Only the psychic for ${activeTeam} types a clue in this step.`;
  }
  if (wavelengthGuessCardCopy) {
    wavelengthGuessCardCopy.textContent = !view
      ? "The active team discusses, drags the dial, and locks one final position."
      : canGuess
        ? "Your team is active. Drag the dial on the track, then submit the final position."
        : `${activeTeam} is the team that places the dial this round. Your team is ${yourTeam}.`;
  }
  if (wavelengthSideCardCopy) {
    wavelengthSideCardCopy.textContent = !view
      ? "After the dial is locked, the other team guesses LEFT or RIGHT."
      : canSide
        ? `Your team is defending. Choose whether the hidden target is LEFT or RIGHT of ${activeTeam}'s dial.`
        : `${opponentTeam} is the team that makes the side guess after ${activeTeam} locks the dial.`;
  }
  if (wavelengthContinueCardCopy) {
    wavelengthContinueCardCopy.textContent = canContinue
      ? "Round recap is ready. Confirm to move on."
      : "After reveal, everyone confirms here before the next round starts.";
  }
}

function setWavelengthZone(zoneEl, center, halfWidth, labelEl) {
  if (!zoneEl) return;
  if (typeof center !== "number" || Number.isNaN(center)) {
    zoneEl.classList.add("hidden");
    if (labelEl) {
      labelEl.classList.add("hidden");
    }
    return;
  }
  const leftRatio = Math.max(0, (center - halfWidth + 1) / 2);
  const rightRatio = Math.min(1, (center + halfWidth + 1) / 2);
  const widthRatio = Math.max(0, rightRatio - leftRatio);
  zoneEl.style.left = `${leftRatio * 100}%`;
  zoneEl.style.width = `${widthRatio * 100}%`;
  zoneEl.classList.remove("hidden");
  if (labelEl) {
    labelEl.style.left = `${((leftRatio + rightRatio) / 2) * 100}%`;
    labelEl.classList.remove("hidden");
  }
}

function setWavelengthZones(center) {
  WAVELENGTH_SCORE_BANDS.forEach((band) => {
    setWavelengthZone(band.el, center, band.halfWidth, band.labelEl);
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
    const side = last.side_guess === "LEFT" ? "⬅️ LEFT" : "RIGHT ➡️";
    row.textContent = `R${last.round_number} · ${formatWavelengthTeam(last.active_team)} clue "${last.clue_text}" · `
      + `${card.left_label || "左侧"} ↔ ${card.right_label || "右侧"} · `
      + `team ${Number(last.guess_pos).toFixed(2)} · opponent ${side} · `
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
  if (wavelengthCan("continue_next_round")) {
    const summary = currentWavelengthView && currentWavelengthView.round_pause_summary;
    const confirmed = Array.isArray(currentWavelengthView && currentWavelengthView.continue_confirmed_player_ids)
      ? currentWavelengthView.continue_confirmed_player_ids.length
      : 0;
    const total = Number(currentWavelengthView && currentWavelengthView.continue_total_players) || 0;
    if (summary) {
      const side = summary.side_guess === "LEFT" ? "left ⬅️" : "right ➡️";
      wavelengthStatusBody.textContent = `Recap: your guess ${Number(summary.guess_pos).toFixed(2)}, opponent guessed ${side}. Continue ${confirmed}/${total}.`;
    } else {
      wavelengthStatusBody.textContent = `Round recap ready. Continue ${confirmed}/${total}.`;
    }
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
  if (wavelengthGuessValue) wavelengthGuessValue.textContent = "Center 0.00";
  if (wavelengthClueInput) wavelengthClueInput.value = "";
  wavelengthEditableGuessPos = 0;
  setWavelengthZones(null);
  setWavelengthMarker(wavelengthTrackTarget, null);
  setWavelengthMarker(wavelengthTrackGuess, null);
  updateWavelengthStatus(null);
  updateWavelengthActionButtons();
  updateWavelengthActionCards(null);
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
  updateWavelengthActionCards(view);
}

function showWavelengthHelpModal() {
  if (!wavelengthHelpModal) return;
  if (wavelengthHelpContent) wavelengthHelpContent.innerHTML = WAVELENGTH_HELP_HTML;
  setModalVisible(wavelengthHelpModal, true);
}

function exitWavelengthExplainMode() {
  wavelengthExplainMode = false;
  document.body.classList.remove("wavelength-explain-mode");
  if (wavelengthExplainBtn) wavelengthExplainBtn.classList.remove("active");
}

function closeWavelengthHelpModal() {
  if (wavelengthHelpModal) setModalVisible(wavelengthHelpModal, false);
}

function showWavelengthHeaderActions(show) {
  if (wavelengthHeaderActions) wavelengthHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    exitWavelengthExplainMode();
    closeWavelengthHelpModal();
    if (wavelengthExplainModal) setModalVisible(wavelengthExplainModal, false);
  }
}

function showWavelengthExplanation(explainId) {
  if (!wavelengthExplainModal || !wavelengthExplainContent) return;
  if (explainId in WAVELENGTH_EXPLAIN) {
    wavelengthExplainContent.innerHTML = `<p>${WAVELENGTH_EXPLAIN[explainId]}</p>`;
    setModalVisible(wavelengthExplainModal, true);
    return;
  }
  const build = wavelengthExplainTargets[explainId];
  if (!build) return;
  const explanation = build();
  if (!explanation) return;
  wavelengthExplainContent.innerHTML = `<h3>${explanation.title}</h3><p>${explanation.body}</p>`;
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

if (wavelengthContinueBtn) {
  wavelengthContinueBtn.addEventListener("click", () => {
    if (!wavelengthCan("continue_next_round")) return;
    sendAction({ type: "continue_next_round" });
  });
}

document.addEventListener("pointerdown", (e) => {
  if (!wavelengthExplainMode) return;
  const explainTarget = e.target.closest(".has-explanation");
  if (!explainTarget) {
    exitWavelengthExplainMode();
    return;
  }
  const explainId = explainTarget.id || "";
  if (explainId in WAVELENGTH_EXPLAIN || explainId in wavelengthExplainTargets) {
    e.preventDefault();
    e.stopPropagation();
    showWavelengthExplanation(explainId);
    exitWavelengthExplainMode();
  }
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && wavelengthExplainMode) {
    exitWavelengthExplainMode();
  }
});
