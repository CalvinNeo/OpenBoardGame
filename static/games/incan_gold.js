let currentIncanGoldView = null;
let incanGoldExplainMode = false;
let incanGoldTooltipTimer = null;
let incanGoldGuideReturnFocus = null;

const INCAN_GOLD_HAZARD_ICONS = {
  snake: "🐍",
  spider: "🕷️",
  fire: "🔥",
  rockfall: "🪨",
  mummy: "🧟",
};

const incanGoldPhaseLabel = document.getElementById("incanGoldPhase");
const incanGoldRoundLabel = document.getElementById("incanGoldRound");
const incanGoldMaxRoundsLabel = document.getElementById("incanGoldMaxRounds");
const incanGoldDeckLabel = document.getElementById("incanGoldDeck");
const incanGoldInCaveLabel = document.getElementById("incanGoldInCave");
const incanGoldDecidedLabel = document.getElementById("incanGoldDecided");
const incanGoldWinnerLabel = document.getElementById("incanGoldWinner");
const incanGoldRoundNotice = document.getElementById("incanGoldRoundNotice");
const incanGoldRoundNoticeTitle = document.getElementById("incanGoldRoundNoticeTitle");
const incanGoldRoundNoticeBody = document.getElementById("incanGoldRoundNoticeBody");
const incanGoldPath = document.getElementById("incanGoldPath");
const incanGoldPlayers = document.getElementById("incanGoldPlayers");
const incanGoldRemovedHazards = document.getElementById("incanGoldRemovedHazards");
const incanGoldContinueBtn = document.getElementById("incanGoldContinueBtn");
const incanGoldLeaveBtn = document.getElementById("incanGoldLeaveBtn");
const incanGoldNextRoundBtn = document.getElementById("incanGoldNextRoundBtn");
const incanGoldPlayAgainBtn = document.getElementById("incanGoldPlayAgainBtn");
const incanGoldGamePanel = document.getElementById("incanGoldPanel");
const incanGoldStatus = document.getElementById("incanGoldStatus");
const incanGoldHelpBtn = document.getElementById("incanGoldHelpBtn");
const incanGoldExplainBtn = document.getElementById("incanGoldExplainBtn");
const incanGoldGuide = document.getElementById("incanGoldGuide");
const incanGoldGuideCloseBtn = document.getElementById("incanGoldGuideCloseBtn");
const incanGoldTooltip = document.createElement("div");
incanGoldTooltip.className = "incan-gold-tooltip";
incanGoldTooltip.id = "incanGoldTooltip";
incanGoldTooltip.setAttribute("role", "tooltip");
incanGoldTooltip.hidden = true;
document.body.appendChild(incanGoldTooltip);

const INCAN_GOLD_EXPLANATIONS = {
  continue: "Continue exploring. You share the next treasure with explorers still in the cave. A second matching hazard loses all gems in hand, but your banked gems and artifacts remain safe.",
  leave: "Return to camp and bank your gems. Returning explorers divide the remainder on each treasure card separately. If you leave alone, you also collect every artifact (🏺); if several leave together, those artifacts are discarded.",
  next: "Confirm you have reviewed the round. The next expedition begins after every player confirms. Bots confirm automatically; your confirmation does not skip other players' review.",
  again: "Start a fresh five-round game with the same players. Scores, artifacts and removed hazards reset.",
};

const INCAN_GOLD_HELP = [
  "Goal: collect the most gems (💎) over five expeditions. Banked gems plus artifact points determine your score; artifact count breaks ties.",
  "Each step, secretly choose Continue or Leave. Choices are revealed together only after all explorers decide. Leaving banks your hand and divides each treasure card's remainder separately among returners.",
  "Treasure (💎) is divided equally among explorers still in the cave. Undivided gems stay on that card. Artifact (🏺) goes only to a lone returner; multiple returners discard it. Artifacts are worth 5 points in rounds 1–3 and 10 in rounds 4–5.",
  "Hazards: Snake (🐍), Spider (🕷️), Fire (🔥), Rockfall (🪨), Mummy (🧟). The first of a kind is a warning. The second ends the expedition: explorers lose their hand, and one card of that hazard is permanently removed.",
  "When everyone returns or the deck empties, the expedition ends safely. Review the results and click Next Round; all players must confirm. Play Again appears only after the fifth round.",
  "Risk is the next-card bust chance based on revealed cards and removed hazards. Hover or tap informational cards for a short explanation, or use Explain to inspect a control without taking an action.",
];

function formatIncanGoldHazard(hazard) {
  if (!hazard) {
    return "Unknown";
  }
  const emoji = INCAN_GOLD_HAZARD_ICONS[hazard] || "⚠️";
  const label = hazard.replace(/_/g, " ");
  return `${emoji} ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function renderIncanGoldPath(view) {
  if (!incanGoldPath) {
    return;
  }
  incanGoldPath.innerHTML = "";
  if (!view || !Array.isArray(view.path) || !view.path.length) {
    const empty = document.createElement("div");
    empty.className = "incan-gold-empty";
    empty.textContent = "No cards yet";
    incanGoldPath.appendChild(empty);
    return;
  }
  view.path.forEach((card) => {
    const wrapper = document.createElement("div");
    wrapper.className = `incan-gold-card ${card.type || ""}`;

    const title = document.createElement("div");
    title.className = "incan-gold-card-title";
    if (card.type === "treasure") {
      title.textContent = `💎 Treasure ${card.value ?? 0}`;
    } else if (card.type === "hazard") {
      title.textContent = formatIncanGoldHazard(card.hazard);
    } else if (card.type === "artifact") {
      title.textContent = `🏺 Artifact ${card.value ?? 0}`;
    } else {
      title.textContent = "Unknown";
    }
    wrapper.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "incan-gold-card-meta";
    if (card.type === "treasure") {
      meta.textContent = `Remainder: ${card.remainder ?? 0}`;
    } else if (card.type === "hazard") {
      meta.textContent = card.triggered ? "Triggered" : "Warning";
    } else if (card.type === "artifact") {
      meta.textContent = "Solo leaver only";
    }
    wrapper.appendChild(meta);
    wrapper.dataset.incanTip = card.type === "treasure"
      ? `Treasure (💎): ${card.value} gems. ${card.remainder || 0} remain on this card for returning explorers to divide.`
      : card.type === "artifact"
        ? `Artifact (🏺): ${card.value} points for a lone returner; discarded if multiple explorers return together.`
        : `${formatIncanGoldHazard(card.hazard)}: ${card.triggered ? "Repeated hazard! Explorers lost their hand." : "A second matching hazard ends the expedition."}`;

    incanGoldPath.appendChild(wrapper);
  });
}

function renderIncanGoldPlayers(view) {
  if (!incanGoldPlayers) {
    return;
  }
  incanGoldPlayers.innerHTML = "";
  if (!view || !Array.isArray(view.players)) {
    return;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "incan-gold-player";
    card.classList.toggle("is-you", player.player_id === view.you);

    const name = document.createElement("div");
    name.className = "incan-gold-player-name";
    name.textContent = `${player.name || player.player_id}${player.player_id === view.you ? " · You" : ""}${player.is_bot ? " · AI" : ""}`;
    card.appendChild(name);

    const line1 = document.createElement("div");
    line1.className = "incan-gold-player-line incan-gold-player-stats";
    [`Banked ${player.banked_gems ?? 0}`, `Hand ${player.hand_gems ?? 0}`].forEach((text) => {
      const stat = document.createElement("span");
      stat.textContent = text;
      line1.appendChild(stat);
    });
    card.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "incan-gold-player-line incan-gold-player-stats";
    [`🏺 ${player.artifact_count ?? 0} (+${player.artifact_points ?? 0})`, `Total ${player.total_score ?? 0}`].forEach((text) => {
      const stat = document.createElement("span");
      stat.textContent = text;
      line2.appendChild(stat);
    });
    card.appendChild(line2);

    const line3 = document.createElement("div");
    line3.className = "incan-gold-player-line";
    const lastChoice = (view.last_decisions || {})[player.player_id];
    line3.textContent = view.phase === "round_end"
      ? ((view.next_round_ready || []).includes(player.player_id) ? "✓ Ready" : "Reviewing round")
      : view.game_over ? "Finished"
        : player.status !== "in_cave" ? "⛺ In camp"
          : player.decided ? "✓ Locked" : "Choosing";
    if (lastChoice) line3.textContent += ` · ${lastChoice === "leave" ? "Left" : "Continued"}`;
    card.dataset.incanTip = `${player.name || player.player_id}: ${player.banked_gems || 0} banked gems (💎), ${player.hand_gems || 0} gems at risk, ${player.artifact_count || 0} artifacts (🏺) worth ${player.artifact_points || 0} points. Total safe score: ${player.total_score || 0}.`;
    card.appendChild(line3);

    incanGoldPlayers.appendChild(card);
  });
}

function renderIncanGoldHazards(view) {
  if (!incanGoldRemovedHazards) {
    return;
  }
  incanGoldRemovedHazards.innerHTML = "";
  const removed = (view && view.removed_hazards) || {};
  const order = ["snake", "spider", "fire", "rockfall", "mummy"];
  order.forEach((hazard) => {
    const chip = document.createElement("div");
    chip.className = "incan-gold-hazard-chip";
    const count = removed[hazard] ?? 0;
    chip.textContent = `${formatIncanGoldHazard(hazard)} × ${count}`;
    chip.dataset.incanTip = `${formatIncanGoldHazard(hazard)}: ${count} permanently removed, ${3 - count} remain in the base deck.`;
    incanGoldRemovedHazards.appendChild(chip);
  });
}

function renderIncanGoldRoundNotice(view) {
  if (!incanGoldRoundNotice || !incanGoldRoundNoticeBody || !incanGoldRoundNoticeTitle) {
    return;
  }
  const roundEnd = view && view.round_end ? view.round_end : {};
  if (!roundEnd || !roundEnd.reason) {
    incanGoldRoundNotice.classList.add("hidden");
    incanGoldRoundNotice.setAttribute("aria-hidden", "true");
    return;
  }
  incanGoldRoundNotice.classList.remove("hidden");
  incanGoldRoundNotice.setAttribute("aria-hidden", "false");
  incanGoldRoundNoticeTitle.textContent = view.game_over ? "Game Over" : "Round End";
  let body = "";
  if (roundEnd.reason === "hazard") {
    body = `💥 Hazard: ${formatIncanGoldHazard(roundEnd.hazard)}`;
  } else if (roundEnd.reason === "all_left") {
    body = "All explorers returned safely.";
  } else if (roundEnd.reason === "deck_empty") {
    body = "Deck empty: explorers returned safely.";
  } else {
    body = roundEnd.reason;
  }
  if (roundEnd.artifacts_removed) {
    body += ` · Artifacts removed: ${roundEnd.artifacts_removed}`;
  }
  incanGoldRoundNoticeBody.textContent = body;
}

function isIncanGoldActionAvailable(actionType) {
  if (!currentIncanGoldView || !Array.isArray(currentIncanGoldView.legal_actions)) {
    return false;
  }
  return currentIncanGoldView.legal_actions.includes(actionType);
}

function updateIncanGoldActionButtons() {
  const active = currentGameType === "incan_gold" && currentIncanGoldView;
  const canDecide = active && isIncanGoldActionAvailable("decide");
  const canNext = active && currentIncanGoldView.phase === "round_end" && isIncanGoldActionAvailable("next_round");
  const canPlayAgain = active && currentIncanGoldView.game_over && isIncanGoldActionAvailable("play_again");
  const states = [
    { el: incanGoldContinueBtn, allowed: canDecide },
    { el: incanGoldLeaveBtn, allowed: canDecide },
    { el: incanGoldNextRoundBtn, allowed: canNext },
    { el: incanGoldPlayAgainBtn, allowed: canPlayAgain },
  ];
  states.forEach(({ el, allowed }) => {
    if (!el) {
      return;
    }
    el.classList.toggle("action-allowed", Boolean(allowed));
    el.classList.toggle("hidden", !allowed);
    el.disabled = !allowed;
  });
}

function clearIncanGoldState() {
  currentIncanGoldView = null;
  setIncanGoldExplainMode(false);
  closeIncanGoldGuide();
  hideIncanGoldTooltip();
  ["incanGoldBanked", "incanGoldHand", "incanGoldArtifacts", "incanGoldLoot"].forEach((id) => {
    document.getElementById(id).textContent = "-";
  });
  document.getElementById("incanGoldRisk").textContent = "Risk -";
  document.getElementById("incanGoldWinnerRow").classList.add("hidden");
  incanGoldStatus.textContent = "Waiting for game state…";
  if (incanGoldPhaseLabel) {
    incanGoldPhaseLabel.textContent = "-";
  }
  if (incanGoldRoundLabel) {
    incanGoldRoundLabel.textContent = "-";
  }
  if (incanGoldMaxRoundsLabel) {
    incanGoldMaxRoundsLabel.textContent = "-";
  }
  if (incanGoldDeckLabel) {
    incanGoldDeckLabel.textContent = "-";
  }
  if (incanGoldInCaveLabel) {
    incanGoldInCaveLabel.textContent = "-";
  }
  if (incanGoldDecidedLabel) {
    incanGoldDecidedLabel.textContent = "-";
  }
  if (incanGoldWinnerLabel) {
    incanGoldWinnerLabel.textContent = "-";
  }
  if (incanGoldRoundNotice) {
    incanGoldRoundNotice.classList.add("hidden");
    incanGoldRoundNotice.setAttribute("aria-hidden", "true");
  }
  if (incanGoldPath) {
    incanGoldPath.innerHTML = "";
  }
  if (incanGoldPlayers) {
    incanGoldPlayers.innerHTML = "";
  }
  if (incanGoldRemovedHazards) {
    incanGoldRemovedHazards.innerHTML = "";
  }
  updateIncanGoldActionButtons();
}

function renderIncanGoldGameState(data) {
  const view = data.view;
  currentIncanGoldView = view;
  if (currentGameType !== "incan_gold") {
    currentGameType = "incan_gold";
    setGamePanelVisibility("incan_gold");
  }

  if (incanGoldPhaseLabel) {
    incanGoldPhaseLabel.textContent = { decision: "Exploring", round_end: "Round review", game_over: "Final scores" }[view.phase] || "Waiting";
  }
  if (incanGoldRoundLabel) {
    incanGoldRoundLabel.textContent = view.round ?? "-";
  }
  if (incanGoldMaxRoundsLabel) {
    incanGoldMaxRoundsLabel.textContent = view.max_rounds ?? "-";
  }
  if (incanGoldDeckLabel) {
    incanGoldDeckLabel.textContent = view.deck_count ?? "-";
  }
  if (incanGoldInCaveLabel) {
    incanGoldInCaveLabel.textContent = view.in_cave_count ?? "-";
  }
  if (incanGoldDecidedLabel) {
    const decided = view.decided_count ?? 0;
    const total = view.in_cave_count ?? "-";
    incanGoldDecidedLabel.textContent = `${decided}/${total}`;
  }
  if (incanGoldWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      incanGoldWinnerLabel.textContent = names.join(", ");
    } else {
      incanGoldWinnerLabel.textContent = "-";
    }
  }

  renderIncanGoldRoundNotice(view);
  renderIncanGoldPath(view);
  renderIncanGoldPlayers(view);
  renderIncanGoldHazards(view);
  renderIncanGoldSummary(view);
  logGameEvents(data);
  updateIncanGoldActionButtons();
}

if (incanGoldContinueBtn) {
  incanGoldContinueBtn.addEventListener("click", () => {
    if (isIncanGoldActionAvailable("decide")) sendAction({ type: "decide", choice: "continue" });
  });
}

if (incanGoldLeaveBtn) {
  incanGoldLeaveBtn.addEventListener("click", () => {
    if (isIncanGoldActionAvailable("decide")) sendAction({ type: "decide", choice: "leave" });
  });
}

if (incanGoldNextRoundBtn) {
  incanGoldNextRoundBtn.addEventListener("click", () => {
    if (isIncanGoldActionAvailable("next_round")) sendAction({ type: "next_round" });
  });
}

if (incanGoldPlayAgainBtn) {
  incanGoldPlayAgainBtn.addEventListener("click", () => {
    if (isIncanGoldActionAvailable("play_again")) sendAction({ type: "play_again" });
  });
}

function renderIncanGoldSummary(view) {
  const player = (view.players || []).find((entry) => entry.player_id === view.you);
  document.getElementById("incanGoldBanked").textContent = player?.banked_gems ?? "-";
  document.getElementById("incanGoldHand").textContent = player?.hand_gems ?? "-";
  document.getElementById("incanGoldArtifacts").textContent = player?.artifact_points ?? "-";
  document.getElementById("incanGoldWinnerRow").classList.toggle("hidden", !view.game_over || !view.winner?.length);
  const danger = Object.entries(view.hazard_counts || {}).reduce((total, [hazard, count]) => {
    return total + (count > 0 ? Math.max(0, 3 - (view.removed_hazards?.[hazard] || 0) - count) : 0);
  }, 0);
  document.getElementById("incanGoldRisk").textContent = view.phase === "decision" && view.deck_count
    ? `Risk ${Math.round(danger / view.deck_count * 100)}%` : "Risk —";
  const remainder = (view.path || []).reduce((total, card) => total + (card.type === "treasure" ? card.remainder || 0 : 0), 0);
  const artifacts = (view.path || []).reduce((total, card) => total + (card.type === "artifact" ? card.value || 0 : 0), 0);
  document.getElementById("incanGoldLoot").textContent = `Left: 💎 ${remainder} · 🏺 ${artifacts}`;
  if (view.game_over) {
    incanGoldStatus.textContent = "All five expeditions complete.";
  } else if (view.phase === "round_end") {
    const ready = view.next_round_ready || [];
    incanGoldStatus.textContent = `${ready.length}/${view.players.length} ready · ${ready.includes(view.you) ? "Waiting for other explorers." : "Review the result, then confirm Next Round."}`;
  } else if (!player) {
    incanGoldStatus.textContent = "Watching the expedition.";
  } else if (player.status !== "in_cave") {
    incanGoldStatus.textContent = "Safe in camp · waiting for the expedition to finish.";
  } else if (view.your_decision) {
    incanGoldStatus.textContent = `${view.your_decision === "leave" ? "Leave" : "Continue"} locked · waiting for other explorers.`;
  } else {
    incanGoldStatus.textContent = "Continue exploring, or return to bank your gems?";
  }
  document.querySelector("#incanGoldPanel .incan-gold-decision-meta").classList.toggle("hidden", view.phase !== "decision");
}

function setIncanGoldExplainMode(enabled) {
  incanGoldExplainMode = Boolean(enabled);
  document.body.classList.toggle("incan-gold-explaining", incanGoldExplainMode);
  incanGoldExplainBtn.setAttribute("aria-pressed", String(incanGoldExplainMode));
  hideIncanGoldTooltip();
}

function openIncanGoldGuide(title, paragraphs) {
  incanGoldGuideReturnFocus = document.activeElement;
  setIncanGoldExplainMode(false);
  document.getElementById("incanGoldGuideTitle").textContent = title;
  const body = document.getElementById("incanGoldGuideBody");
  body.replaceChildren();
  paragraphs.forEach((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    body.appendChild(paragraph);
  });
  incanGoldGuide.classList.remove("hidden");
  incanGoldGuide.setAttribute("aria-hidden", "false");
  incanGoldGuideCloseBtn.focus();
}

function closeIncanGoldGuide() {
  const wasOpen = !incanGoldGuide.classList.contains("hidden");
  incanGoldGuide.classList.add("hidden");
  incanGoldGuide.setAttribute("aria-hidden", "true");
  if (wasOpen && incanGoldGuideReturnFocus?.isConnected) incanGoldGuideReturnFocus.focus();
}

function hideIncanGoldTooltip() {
  window.clearTimeout(incanGoldTooltipTimer);
  incanGoldTooltip.hidden = true;
}

function showIncanGoldTooltip(target) {
  if (!target?.dataset.incanTip || incanGoldExplainMode) return;
  incanGoldTooltip.textContent = target.dataset.incanTip;
  incanGoldTooltip.hidden = false;
  const bounds = target.getBoundingClientRect();
  const tooltipBounds = incanGoldTooltip.getBoundingClientRect();
  incanGoldTooltip.style.left = `${Math.max(10, Math.min(bounds.left, window.innerWidth - tooltipBounds.width - 10))}px`;
  incanGoldTooltip.style.top = `${Math.max(10, Math.min(bounds.bottom + 6, window.innerHeight - tooltipBounds.height - 10))}px`;
  window.clearTimeout(incanGoldTooltipTimer);
  incanGoldTooltipTimer = window.setTimeout(hideIncanGoldTooltip, 3000);
}

function showIncanGoldHeaderActions(show) {
  document.getElementById("incanGoldHeaderActions").style.display = show ? "flex" : "none";
  if (!show) {
    setIncanGoldExplainMode(false);
    closeIncanGoldGuide();
    hideIncanGoldTooltip();
  }
}

incanGoldHelpBtn.addEventListener("click", () => openIncanGoldGuide("Incan Gold · Help", INCAN_GOLD_HELP));
incanGoldExplainBtn.addEventListener("click", () => setIncanGoldExplainMode(!incanGoldExplainMode));
incanGoldGuideCloseBtn.addEventListener("click", closeIncanGoldGuide);
incanGoldGuide.addEventListener("click", (event) => {
  if (event.target === incanGoldGuide) closeIncanGoldGuide();
});
incanGoldGamePanel.addEventListener("pointerover", (event) => {
  if (event.pointerType === "mouse") showIncanGoldTooltip(event.target.closest("[data-incan-tip]"));
});
incanGoldGamePanel.addEventListener("pointerout", hideIncanGoldTooltip);
incanGoldGamePanel.addEventListener("click", (event) => {
  if (!event.target.closest("button, summary")) showIncanGoldTooltip(event.target.closest("[data-incan-tip]"));
});
document.addEventListener("scroll", hideIncanGoldTooltip, true);
document.addEventListener("click", (event) => {
  if (!incanGoldExplainMode || currentGameType !== "incan_gold") return;
  const button = event.target.closest("button");
  if ([incanGoldHelpBtn, incanGoldExplainBtn, incanGoldGuideCloseBtn].includes(button)) return;
  const target = event.target.closest("[data-incan-explain], #incanGoldPanel [data-incan-tip]");
  if (!button && !target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (target) {
    const description = INCAN_GOLD_EXPLANATIONS[target.dataset.incanExplain] || target.dataset.incanTip;
    openIncanGoldGuide("Explanation", [description]);
  }
}, true);
document.addEventListener("pointerdown", (event) => {
  if (!incanGoldExplainMode || currentGameType !== "incan_gold") return;
  for (const button of incanGoldGamePanel.querySelectorAll("button:disabled[data-incan-explain]")) {
    const bounds = button.getBoundingClientRect();
    if (bounds.width && bounds.height && event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openIncanGoldGuide("Explanation", [INCAN_GOLD_EXPLANATIONS[button.dataset.incanExplain]]);
      break;
    }
  }
}, true);
document.addEventListener("keydown", (event) => {
  if (currentGameType !== "incan_gold") return;
  if (event.key === "Escape") {
    setIncanGoldExplainMode(false);
    closeIncanGoldGuide();
    hideIncanGoldTooltip();
  } else if (event.key === "Tab" && !incanGoldGuide.classList.contains("hidden")) {
    event.preventDefault();
    incanGoldGuideCloseBtn.focus();
  }
});
