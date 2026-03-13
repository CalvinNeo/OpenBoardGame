let currentIncanGoldView = null;

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
const incanGoldChoiceLabel = document.getElementById("incanGoldChoice");
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

const incanGoldActionButtons = {
  decide_continue: incanGoldContinueBtn,
  decide_leave: incanGoldLeaveBtn,
  next_round: incanGoldNextRoundBtn,
  play_again: incanGoldPlayAgainBtn,
};

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
    empty.className = "gold-rush-empty";
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

    const name = document.createElement("div");
    name.className = "incan-gold-player-name";
    const tags = [];
    if (player.player_id === view.you) {
      tags.push("you");
    }
    if (player.is_bot) {
      tags.push("bot");
    }
    if (player.status === "in_cave") {
      tags.push("in cave");
    } else {
      tags.push("in camp");
    }
    name.textContent = `${player.name || player.player_id} (${tags.join(", ")})`;
    card.appendChild(name);

    const line1 = document.createElement("div");
    line1.className = "incan-gold-player-line";
    line1.textContent = `Banked 💎 ${player.banked_gems ?? 0} · Hand 💎 ${player.hand_gems ?? 0}`;
    card.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "incan-gold-player-line";
    line2.textContent = `Artifacts 🏺 ${player.artifact_count ?? 0} (+${player.artifact_points ?? 0}) · Total ${
      player.total_score ?? 0
    }`;
    card.appendChild(line2);

    const line3 = document.createElement("div");
    line3.className = "incan-gold-player-line";
    line3.textContent = `Decided: ${player.decided ? "yes" : "no"}`;
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
  if (currentGameType !== "incan_gold") {
    Object.values(incanGoldActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  const canDecide = isIncanGoldActionAvailable("decide");
  const canNext = isIncanGoldActionAvailable("next_round");
  const canPlayAgain = isIncanGoldActionAvailable("play_again");
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
    if (allowed) {
      el.classList.add("action-allowed");
    } else {
      el.classList.remove("action-allowed");
    }
    el.disabled = !allowed;
  });
}

function clearIncanGoldState() {
  currentIncanGoldView = null;
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
  if (incanGoldChoiceLabel) {
    incanGoldChoiceLabel.textContent = "-";
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
    incanGoldPhaseLabel.textContent = view.phase || "-";
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
  if (incanGoldChoiceLabel) {
    if (view.your_decision === "continue") {
      incanGoldChoiceLabel.textContent = "Continue";
    } else if (view.your_decision === "leave") {
      incanGoldChoiceLabel.textContent = "Leave";
    } else {
      incanGoldChoiceLabel.textContent = "-";
    }
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
  logGameEvents(data);
  updateIncanGoldActionButtons();
}

if (incanGoldContinueBtn) {
  incanGoldContinueBtn.addEventListener("click", () => {
    sendAction({ type: "decide", choice: "continue" });
  });
}

if (incanGoldLeaveBtn) {
  incanGoldLeaveBtn.addEventListener("click", () => {
    sendAction({ type: "decide", choice: "leave" });
  });
}

if (incanGoldNextRoundBtn) {
  incanGoldNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (incanGoldPlayAgainBtn) {
  incanGoldPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
}
