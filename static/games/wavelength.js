let currentWavelengthView = null;
let wavelengthExplainMode = false;
let wavelengthDialDragging = false;
let wavelengthGuessPosition = 0;
let wavelengthPreviewTimer = null;
let wavelengthTooltipTimer = null;

const wavelengthById = (id) => document.getElementById(id);
const wavelengthGamePanel = wavelengthById("wavelengthPanel");
const wavelengthHeaderActions = wavelengthById("wavelengthHeaderActions");
const wavelengthHelpBtn = wavelengthById("wavelengthHelpBtn");
const wavelengthExplainBtn = wavelengthById("wavelengthExplainBtn");
const wavelengthHelpModal = wavelengthById("wavelengthHelpModal");
const wavelengthExplainModal = wavelengthById("wavelengthExplainModal");
const wavelengthHelpContent = wavelengthById("wavelengthHelpContent");
const wavelengthExplainContent = wavelengthById("wavelengthExplainContent");
const wavelengthDial = wavelengthById("wavelengthDial");
const wavelengthDialSvg = wavelengthById("wavelengthDialSvg");
const wavelengthScoreZones = wavelengthById("wavelengthScoreZones");
const wavelengthDialTicks = wavelengthById("wavelengthDialTicks");
const wavelengthNeedle = wavelengthById("wavelengthNeedle");
const wavelengthTargetMarker = wavelengthById("wavelengthTargetMarker");
const wavelengthTargetBadge = wavelengthById("wavelengthTarget");
const wavelengthClueInput = wavelengthById("wavelengthClueInput");
const wavelengthTooltip = wavelengthById("wavelengthTooltip");

const wavelengthActionButtons = {
  submit_clue: wavelengthById("wavelengthSubmitClueBtn"),
  submit_team_guess: wavelengthById("wavelengthSubmitGuessBtn"),
  submit_side_guess_left: wavelengthById("wavelengthSideLeftBtn"),
  submit_side_guess_right: wavelengthById("wavelengthSideRightBtn"),
  continue_next_round: wavelengthById("wavelengthContinueBtn"),
};

const wavelengthHelpHtml = `
  <h3>Goal</h3>
  <p>Your team tries to place the dial near the hidden target 🎯 on a spectrum between two concepts.</p>
  <h3>Round flow</h3>
  <ol>
    <li><strong>Psychic (🔮)</strong> sees the hidden target and gives one clue.</li>
    <li>The team drags the red needle and locks one position.</li>
    <li>The opponents choose whether the target is to the left ⬅️ or right ➡️.</li>
    <li>The target is revealed and everyone reviews the score.</li>
  </ol>
  <h3>Scoring</h3>
  <ul><li>2 / 3 / 4 points are awarded by distance from the target.</li><li>The opponent earns 1 point for a correct side guess, except when the team scores 4.</li></ul>
  <h3>Terms</h3>
  <p>Psychic (🔮) gives the clue. Team dial (🧭) is the red needle. Target (🎯) is the hidden position. Score zones are the colored wedges.</p>
`;

const wavelengthExplanations = {
  dial: ["Target dial", "The red needle shows the team's position on the semicircle. Drag it when your team is placing the dial."],
  spectrum: ["Spectrum", "The left and right labels define this round's scale. The hidden target lies somewhere between them."],
  clue: ["Clue", "The Psychic (🔮) gives one clue. Teammates interpret it against the two ends of the spectrum."],
  target: ["Target", "Target (🎯) stays hidden until the reveal. The colored wedges show 2, 3 and 4 point scoring zones after reveal."],
  score: ["Scoreboard", "Each team's score is shown here. Your team is outlined so it is easy to find."],
  role: ["Your role", "Your Team and Role show whether you are the Psychic (🔮), a dial teammate, or an opponent."],
  phase: ["Round status", "The status line tells you which phase is active and what your next step is."],
  players: ["Players", "Players lists the teams and marks the Psychic (🔮) for this round."],
  history: ["Previous round", "The latest resolved round remains available here for a quick review."],
  submit_clue: ["Submit clue", "Send the Psychic's (🔮) one clue. The team can then place the dial."],
  submit_team_guess: ["Lock team guess", "Lock the current red needle position. This starts the opponent side guess."],
  submit_side_guess: ["Side guess", "Choose whether the hidden Target (🎯) is left ⬅️ or right ➡️ of the locked needle."],
  continue_next_round: ["Next Round", "Confirm that you have reviewed the reveal. The next round starts after every player confirms."],
  nudge: ["Fine adjustment", "Move the needle a small step left or right before locking the team guess."],
};

function wavelengthCan(action) {
  return Boolean(currentWavelengthView && Array.isArray(currentWavelengthView.legal_actions)
    && currentWavelengthView.legal_actions.includes(action));
}

function wavelengthTeamName(team) {
  return team === "A" ? "🔵 Team A" : team === "B" ? "🟠 Team B" : "—";
}

function wavelengthPhaseName(phase) {
  return ({ psychic_clue: "Psychic clue", team_guess: "Team dial", opponent_guess: "Side guess", round_summary: "Reveal", game_over: "Game over" })[phase] || "Waiting";
}

function wavelengthSetModal(modal, visible) {
  if (typeof setModalVisible === "function") setModalVisible(modal, visible);
  else if (modal) {
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", String(!visible));
  }
}

function wavelengthSetNeedle(pos) {
  const safe = Number.isFinite(Number(pos)) ? Math.max(-1, Math.min(1, Number(pos))) : 0;
  wavelengthGuessPosition = safe;
  if (wavelengthNeedle) wavelengthNeedle.setAttribute("transform", `rotate(${safe * 90} 300 290)`);
  const dialValue = wavelengthById("wavelengthGuessValue");
  const mirror = wavelengthById("wavelengthGuessValueMirror");
  const text = `${safe < -0.01 ? "Left" : safe > 0.01 ? "Right" : "Center"} · ${safe.toFixed(2)}`;
  if (dialValue) dialValue.textContent = text;
  if (mirror) mirror.textContent = safe.toFixed(2);
  if (wavelengthDial) {
    wavelengthDial.setAttribute("aria-valuenow", safe.toFixed(2));
    wavelengthDial.setAttribute("aria-valuetext", text);
  }
}

function wavelengthDialPosition(clientX, clientY) {
  if (!wavelengthDialSvg) return 0;
  const point = wavelengthDialSvg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = wavelengthDialSvg.getScreenCTM();
  if (!matrix) return 0;
  const local = point.matrixTransform(matrix.inverse());
  const angle = Math.atan2(local.y - 290, local.x - 300) * 180 / Math.PI;
  let normalized = angle;
  if (normalized < 180) normalized += 360;
  return Math.max(-1, Math.min(1, (normalized - 270) / 90));
}

function wavelengthPolar(pos, radius) {
  const angle = (270 + pos * 90) * Math.PI / 180;
  return { x: 300 + radius * Math.cos(angle), y: 290 + radius * Math.sin(angle) };
}

function wavelengthAnnularPath(start, end, innerRadius, outerRadius) {
  const a = wavelengthPolar(start, outerRadius);
  const b = wavelengthPolar(end, outerRadius);
  const c = wavelengthPolar(end, innerRadius);
  const d = wavelengthPolar(start, innerRadius);
  const large = Math.abs(end - start) > 1 ? 1 : 0;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${d.x.toFixed(1)} ${d.y.toFixed(1)} Z`;
}

function wavelengthRenderTicks() {
  if (!wavelengthDialTicks) return;
  wavelengthDialTicks.replaceChildren();
  for (let i = 0; i <= 10; i += 1) {
    const pos = -1 + i / 5;
    const outer = wavelengthPolar(pos, 244);
    const inner = wavelengthPolar(pos, i % 5 === 0 ? 226 : 235);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", inner.x); line.setAttribute("y1", inner.y);
    line.setAttribute("x2", outer.x); line.setAttribute("y2", outer.y);
    if (i % 5 === 0) line.classList.add("wavelength-major-tick");
    wavelengthDialTicks.appendChild(line);
  }
}

function wavelengthRenderZones(center) {
  if (!wavelengthScoreZones) return;
  wavelengthScoreZones.replaceChildren();
  if (typeof center !== "number" || !Number.isFinite(center)) return;
  const bands = [
    { score: 2, width: 0.38, labelRadius: 205, className: "wavelength-score-zone--2" },
    { score: 3, width: 0.24, labelRadius: 154, className: "wavelength-score-zone--3" },
    { score: 4, width: 0.12, labelRadius: 100, className: "wavelength-score-zone--4" },
  ];
  bands.forEach((band) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", wavelengthAnnularPath(Math.max(-1, Number(center) - band.width), Math.min(1, Number(center) + band.width), 34, 238));
    path.dataset.score = String(band.score);
    path.classList.add("wavelength-score-zone", band.className);
    path.setAttribute("aria-label", `${band.score} point zone`);
    wavelengthScoreZones.appendChild(path);
    const labelPoint = wavelengthPolar(Number(center), band.labelRadius);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.textContent = `${band.score} pts`;
    label.setAttribute("x", labelPoint.x); label.setAttribute("y", labelPoint.y);
    label.dataset.score = String(band.score);
    wavelengthScoreZones.appendChild(label);
  });
}

function wavelengthRenderPlayers(view) {
  const list = wavelengthById("wavelengthPlayers");
  if (!list) return;
  list.replaceChildren();
  (view.players || []).forEach((player) => {
    const row = document.createElement("div");
    row.className = "wavelength-player-row";
    if (player.player_id === (typeof playerId !== "undefined" ? playerId : null)) row.classList.add("is-you");
    row.textContent = `${wavelengthTeamName(player.team_id)} · ${player.name || "Player"}${player.is_psychic ? " · 🔮 Psychic" : ""}`;
    list.appendChild(row);
  });
}

function wavelengthRenderHistory(view) {
  const list = wavelengthById("wavelengthHistory");
  if (!list) return;
  list.replaceChildren();
  const rows = Array.isArray(view.history_tail) ? view.history_tail.slice().reverse() : [];
  if (!rows.length) { list.textContent = "No resolved round yet."; return; }
  rows.forEach((round) => {
    const row = document.createElement("div");
    row.className = "wavelength-history-row";
    row.textContent = `R${round.round_number} · ${wavelengthTeamName(round.active_team)} · ${round.card?.left_label || "Left"} ↔ ${round.card?.right_label || "Right"} · +${round.active_points} / +${round.opponent_points}`;
    list.appendChild(row);
  });
}

function wavelengthRenderScoreCards(container, scores, view) {
  if (!container) return;
  container.replaceChildren();
  ["A", "B"].forEach((team) => {
    const card = document.createElement("div");
    card.className = "wavelength-score-card";
    if (team === view.your_team) card.classList.add("is-you");
    const label = document.createElement("span"); label.textContent = wavelengthTeamName(team);
    const score = document.createElement("strong"); score.textContent = String(scores[team] ?? 0);
    card.append(label, score); container.appendChild(card);
  });
}

function wavelengthUpdateActionCards(view) {
  const phase = view?.phase;
  const mapping = {
    wavelengthClueCard: phase === "psychic_clue" && wavelengthCan("submit_clue"),
    wavelengthGuessCard: phase === "team_guess" && wavelengthCan("submit_team_guess"),
    wavelengthSideCard: phase === "opponent_guess" && wavelengthCan("submit_side_guess"),
  };
  Object.entries(mapping).forEach(([id, visible]) => {
    const card = wavelengthById(id);
    if (card) { card.classList.toggle("hidden", !visible); card.classList.toggle("is-active", visible); }
  });
  const clueCopy = wavelengthById("wavelengthClueCardCopy");
  if (clueCopy) clueCopy.textContent = wavelengthCan("submit_clue") ? "You are the Psychic (🔮). Give one short clue." : "The Psychic (🔮) is giving one clue.";
  const guessCopy = wavelengthById("wavelengthGuessCardCopy");
  if (guessCopy) guessCopy.textContent = wavelengthCan("submit_team_guess") ? "Drag the red needle, then lock your team's final position." : "The active team is placing the dial.";
  const sideCopy = wavelengthById("wavelengthSideCardCopy");
  if (sideCopy) sideCopy.textContent = wavelengthCan("submit_side_guess") ? "Choose whether the hidden target is left or right of the needle." : "The opposing team is choosing a side.";
  const continueCard = wavelengthById("wavelengthContinueCard");
  if (continueCard) continueCard.classList.toggle("is-active", wavelengthCan("continue_next_round"));
  const clue = wavelengthById("wavelengthClueInput");
  if (clue) clue.disabled = !wavelengthCan("submit_clue");
  Object.entries(wavelengthActionButtons).forEach(([key, button]) => {
    if (!button) return;
    const allowed = key === "submit_side_guess_left" || key === "submit_side_guess_right"
      ? wavelengthCan("submit_side_guess") : wavelengthCan(key);
    button.disabled = !allowed;
  });
  ["wavelengthNudgeLeftBtn", "wavelengthNudgeRightBtn"].forEach((id) => {
    const button = wavelengthById(id); if (button) button.disabled = !wavelengthCan("submit_team_guess");
  });
  if (wavelengthDial) wavelengthDial.classList.toggle("is-draggable", wavelengthCan("submit_team_guess"));
}

function wavelengthRenderRecap(view) {
  const recap = wavelengthById("wavelengthRecap");
  const summary = view.round_pause_summary || view.last_round_summary;
  const visible = Boolean(summary && (view.phase === "round_summary" || view.game_over));
  if (recap) recap.classList.toggle("hidden", !visible);
  if (!visible) return;
  wavelengthRenderScoreCards(wavelengthById("wavelengthRecapScores"), summary.scores_after || view.scores || {}, view);
  const detail = wavelengthById("wavelengthRecapDetail");
  if (detail) detail.textContent = `${wavelengthTeamName(summary.active_team)} guessed ${Number(summary.guess_pos).toFixed(2)}. The target was ${Number(summary.target_center).toFixed(2)}. ${summary.side_guess === "LEFT" ? "⬅️ Left" : "Right ➡️"} was ${summary.side_guess_correct ? "correct" : "not correct"}.`;
  const progress = wavelengthById("wavelengthContinueProgress");
  const confirmed = Array.isArray(view.continue_confirmed_player_ids) ? view.continue_confirmed_player_ids.length : 0;
  const total = Number(view.continue_total_players) || 0;
  if (progress) progress.textContent = view.game_over ? "Game over" : `${confirmed} / ${total} ready`;
}

function wavelengthRenderStatus(view) {
  const body = wavelengthById("wavelengthStatusBody");
  if (!body) return;
  if (!view) { body.textContent = "Choose a team to begin."; return; }
  if (view.game_over) body.textContent = `Game over · ${wavelengthTeamName(view.winner)} wins.`;
  else if (wavelengthCan("submit_clue")) body.textContent = "Your turn: give one clue as the Psychic (🔮).";
  else if (wavelengthCan("submit_team_guess")) body.textContent = "Your turn: drag the red needle and lock the team guess.";
  else if (wavelengthCan("submit_side_guess")) body.textContent = "Your turn: choose LEFT ⬅️ or RIGHT ➡️.";
  else if (wavelengthCan("continue_next_round")) body.textContent = "Review the reveal, then confirm Next Round.";
  else body.textContent = `Waiting for ${wavelengthTeamName(view.active_team)}.`;
}

function renderWavelengthGameState(data) {
  const view = data?.view || {};
  currentWavelengthView = view;
  if (typeof currentGameType !== "undefined" && currentGameType !== "wavelength") currentGameType = "wavelength";
  if (typeof setGamePanelVisibility === "function") setGamePanelVisibility("wavelength");
  const card = view.spectrum_card || {};
  const scores = view.scores || {};
  const phaseLabel = wavelengthById("wavelengthPhase"); if (phaseLabel) phaseLabel.textContent = wavelengthPhaseName(view.phase);
  const round = wavelengthById("wavelengthRound"); if (round) round.textContent = view.round ?? "—";
  const yourTeam = wavelengthById("wavelengthYourTeam"); if (yourTeam) yourTeam.textContent = wavelengthTeamName(view.your_team);
  const yourRole = wavelengthById("wavelengthYourRole"); if (yourRole) yourRole.textContent = view.your_role === "psychic" ? "Psychic 🔮" : "Team player";
  const left = wavelengthById("wavelengthLeftLabel"); if (left) left.textContent = card.left_label || "Left";
  const right = wavelengthById("wavelengthRightLabel"); if (right) right.textContent = card.right_label || "Right";
  const spectrum = wavelengthById("wavelengthCard"); if (spectrum) spectrum.textContent = `${card.left_label || "Left"} ↔ ${card.right_label || "Right"}`;
  const clue = wavelengthById("wavelengthClue"); if (clue) clue.textContent = view.clue_text || "Waiting for the Psychic…";
  const targetVisible = typeof view.target_center === "number" && Number.isFinite(view.target_center);
  if (wavelengthTargetBadge) wavelengthTargetBadge.textContent = targetVisible ? `Target · ${Number(view.target_center).toFixed(2)}` : "Target hidden";
  if (wavelengthTargetMarker) wavelengthTargetMarker.classList.toggle("is-hidden-target", !targetVisible);
  if (wavelengthTargetMarker && targetVisible) wavelengthTargetMarker.setAttribute("transform", `rotate(${Number(view.target_center) * 90} 300 290)`);
  wavelengthRenderZones(targetVisible ? Number(view.target_center) : null);
  const pos = view.phase === "team_guess" ? (Number.isFinite(Number(view.team_guess_preview_pos)) ? view.team_guess_preview_pos : wavelengthGuessPosition) : view.team_guess_pos;
  wavelengthSetNeedle(Number.isFinite(Number(pos)) ? Number(pos) : 0);
  const scoresEl = wavelengthById("wavelengthScores"); wavelengthRenderScoreCards(scoresEl, scores, view);
  wavelengthRenderPlayers(view); wavelengthRenderHistory(view); wavelengthRenderRecap(view); wavelengthRenderStatus(view); wavelengthUpdateActionCards(view);
}

function clearWavelengthState() {
  currentWavelengthView = null; wavelengthExplainMode = false; wavelengthDialDragging = false; wavelengthGuessPosition = 0;
  if (wavelengthDial) wavelengthDial.classList.remove("is-draggable");
  wavelengthSetNeedle(0); wavelengthRenderZones(null);
  if (wavelengthById("wavelengthRecap")) wavelengthById("wavelengthRecap").classList.add("hidden");
  wavelengthExitExplainMode(); wavelengthSetModal(wavelengthHelpModal, false); wavelengthSetModal(wavelengthExplainModal, false);
}

function showWavelengthHeaderActions(show) {
  if (wavelengthHeaderActions) wavelengthHeaderActions.style.display = show ? "flex" : "none";
  if (!show) { wavelengthExitExplainMode(); wavelengthSetModal(wavelengthHelpModal, false); wavelengthSetModal(wavelengthExplainModal, false); }
}

function wavelengthExitExplainMode() {
  wavelengthExplainMode = false; document.body.classList.remove("wavelength-explain-mode");
  if (wavelengthExplainBtn) { wavelengthExplainBtn.classList.remove("active"); wavelengthExplainBtn.setAttribute("aria-pressed", "false"); }
}

function wavelengthShowExplanation(key) {
  const explanation = wavelengthExplanations[key];
  if (!explanation || !wavelengthExplainContent) return;
  wavelengthExplainContent.innerHTML = `<h3>${explanation[0]}</h3><p>${explanation[1]}</p>`;
  wavelengthSetModal(wavelengthExplainModal, true); wavelengthExitExplainMode();
}

function wavelengthShowTooltip(target) {
  if (!target || !wavelengthTooltip) return;
  clearTimeout(wavelengthTooltipTimer); wavelengthTooltip.textContent = target.dataset.wavelengthTip || ""; wavelengthTooltip.hidden = false;
  const rect = target.getBoundingClientRect();
  wavelengthTooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - wavelengthTooltip.offsetWidth - 8, rect.left))}px`;
  wavelengthTooltip.style.top = `${Math.min(window.innerHeight - wavelengthTooltip.offsetHeight - 8, rect.bottom + 8)}px`;
  wavelengthTooltipTimer = setTimeout(() => { if (wavelengthTooltip) wavelengthTooltip.hidden = true; }, 3000);
}

function wavelengthExplainTargetAtPoint(clientX, clientY) {
  if (!wavelengthGamePanel) return null;
  const candidates = [...wavelengthGamePanel.querySelectorAll("[data-wavelength-explain]")].reverse();
  return candidates.find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }) || null;
}

function wavelengthSendPreview(pos) {
  if (!wavelengthCan("submit_team_guess")) return;
  wavelengthGuessPosition = Math.max(-1, Math.min(1, Number(pos) || 0));
  wavelengthSetNeedle(wavelengthGuessPosition);
  clearTimeout(wavelengthPreviewTimer);
  wavelengthPreviewTimer = setTimeout(() => sendAction({ type: "update_team_guess", pos: wavelengthGuessPosition }), 60);
}

function wavelengthNudge(delta) { wavelengthSendPreview(wavelengthGuessPosition + delta); }

function wavelengthCloseModal(event) {
  if (event.key === "Escape") { wavelengthSetModal(wavelengthHelpModal, false); wavelengthSetModal(wavelengthExplainModal, false); wavelengthExitExplainMode(); }
}

wavelengthRenderTicks(); wavelengthSetNeedle(0);
if (wavelengthHelpBtn) wavelengthHelpBtn.addEventListener("click", () => { if (wavelengthHelpContent) wavelengthHelpContent.innerHTML = wavelengthHelpHtml; wavelengthSetModal(wavelengthHelpModal, true); });
if (wavelengthExplainBtn) wavelengthExplainBtn.addEventListener("click", () => { wavelengthExplainMode = !wavelengthExplainMode; document.body.classList.toggle("wavelength-explain-mode", wavelengthExplainMode); wavelengthExplainBtn.classList.toggle("active", wavelengthExplainMode); wavelengthExplainBtn.setAttribute("aria-pressed", String(wavelengthExplainMode)); });
if (wavelengthById("wavelengthHelpModalCloseBtn")) wavelengthById("wavelengthHelpModalCloseBtn").addEventListener("click", () => wavelengthSetModal(wavelengthHelpModal, false));
if (wavelengthById("wavelengthExplainModalCloseBtn")) wavelengthById("wavelengthExplainModalCloseBtn").addEventListener("click", () => wavelengthSetModal(wavelengthExplainModal, false));
document.addEventListener("keydown", wavelengthCloseModal);

if (wavelengthClueInput) wavelengthClueInput.addEventListener("input", () => { const btn = wavelengthActionButtons.submit_clue; if (btn) btn.disabled = !wavelengthCan("submit_clue") || !wavelengthClueInput.value.trim(); });
if (wavelengthActionButtons.submit_clue) wavelengthActionButtons.submit_clue.addEventListener("click", () => { const clue = wavelengthClueInput?.value.trim(); if (clue && wavelengthCan("submit_clue")) sendAction({ type: "submit_clue", clue }); });
if (wavelengthActionButtons.submit_team_guess) wavelengthActionButtons.submit_team_guess.addEventListener("click", () => { if (wavelengthCan("submit_team_guess")) sendAction({ type: "submit_team_guess", pos: wavelengthGuessPosition }); });
if (wavelengthActionButtons.submit_side_guess_left) wavelengthActionButtons.submit_side_guess_left.addEventListener("click", () => { if (wavelengthCan("submit_side_guess")) sendAction({ type: "submit_side_guess", side: "LEFT" }); });
if (wavelengthActionButtons.submit_side_guess_right) wavelengthActionButtons.submit_side_guess_right.addEventListener("click", () => { if (wavelengthCan("submit_side_guess")) sendAction({ type: "submit_side_guess", side: "RIGHT" }); });
if (wavelengthActionButtons.continue_next_round) wavelengthActionButtons.continue_next_round.addEventListener("click", () => { if (wavelengthCan("continue_next_round")) sendAction({ type: "continue_next_round" }); });
if (wavelengthById("wavelengthNudgeLeftBtn")) wavelengthById("wavelengthNudgeLeftBtn").addEventListener("click", () => wavelengthNudge(-0.02));
if (wavelengthById("wavelengthNudgeRightBtn")) wavelengthById("wavelengthNudgeRightBtn").addEventListener("click", () => wavelengthNudge(0.02));

if (wavelengthDial) {
  wavelengthDial.addEventListener("pointerdown", (event) => {
    if (!wavelengthCan("submit_team_guess") || wavelengthExplainMode) return;
    wavelengthDialDragging = true; wavelengthDial.setPointerCapture(event.pointerId); wavelengthSendPreview(wavelengthDialPosition(event.clientX, event.clientY)); event.preventDefault();
  });
  wavelengthDial.addEventListener("pointermove", (event) => { if (wavelengthDialDragging) { wavelengthSendPreview(wavelengthDialPosition(event.clientX, event.clientY)); event.preventDefault(); } });
  const wavelengthStopDrag = (event) => { if (!wavelengthDialDragging) return; wavelengthDialDragging = false; if (wavelengthDial.hasPointerCapture(event.pointerId)) wavelengthDial.releasePointerCapture(event.pointerId); };
  wavelengthDial.addEventListener("pointerup", wavelengthStopDrag); wavelengthDial.addEventListener("pointercancel", wavelengthStopDrag);
  window.addEventListener("pointerup", wavelengthStopDrag); window.addEventListener("pointercancel", wavelengthStopDrag);
  wavelengthDial.addEventListener("keydown", (event) => { if (!wavelengthCan("submit_team_guess")) return; if (event.key === "ArrowLeft") { event.preventDefault(); wavelengthNudge(-0.02); } if (event.key === "ArrowRight") { event.preventDefault(); wavelengthNudge(0.02); } });
}

document.addEventListener("pointerdown", (event) => {
  const source = event.target.closest?.("[data-wavelength-tip]");
  if (source && !wavelengthExplainMode) wavelengthShowTooltip(source);
  if (!wavelengthExplainMode || !wavelengthGamePanel?.contains(event.target)) return;
  if (event.target.closest("#wavelengthHelpBtn, #wavelengthExplainBtn, #wavelengthHelpModal, #wavelengthExplainModal")) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const target = event.target.closest?.("[data-wavelength-explain]")
    || wavelengthExplainTargetAtPoint(event.clientX, event.clientY);
  if (target) wavelengthShowExplanation(target.dataset.wavelengthExplain);
}, true);
document.addEventListener("pointerover", (event) => { const target = event.target.closest?.("[data-wavelength-tip]"); if (event.pointerType === "mouse" && target && !wavelengthExplainMode) wavelengthShowTooltip(target); }, true);
document.addEventListener("pointerout", (event) => { if (event.pointerType === "mouse" && wavelengthTooltip) wavelengthTooltip.hidden = true; }, true);
document.addEventListener("click", (event) => { const target = event.target.closest?.("[data-wavelength-tip]"); if (target && !wavelengthExplainMode) wavelengthShowTooltip(target); }, true);
