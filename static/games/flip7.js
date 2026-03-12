function clearFlip7TargetSelection() {
  flip7SelectedTarget = null;
  if (currentFlip7View) {
    updateFlip7TargetSelection(currentFlip7View);
    renderFlip7Players(currentFlip7View);
  } else {
    updateFlip7TargetSelection(null);
  }
  updateFlip7ActionButtons();
}

function updateFlip7TargetSelection(view) {
  if (!flip7TargetSelection) {
    return;
  }
  if (!flip7SelectedTarget || !view) {
    flip7TargetSelection.textContent = "-";
    return;
  }
  const target = view.players.find((p) => p.player_id === flip7SelectedTarget);
  flip7TargetSelection.textContent = target ? target.name : "-";
}

function renderFlip7Tableau(view) {
  if (!flip7Tableau) {
    return;
  }
  flip7Tableau.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  if (!you || !Array.isArray(you.tableau) || !you.tableau.length) {
    flip7Tableau.textContent = "-";
    return;
  }
  you.tableau.forEach((card) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.textContent = card.label || "?";
    flip7Tableau.appendChild(slot);
  });
}

function renderFlip7Players(view) {
  if (!flip7Players) {
    return;
  }
  flip7Players.innerHTML = "";
  const pending = view.pending_action;
  const eligible = new Set((pending && pending.eligible_targets) || []);
  const isPendingActor = pending && view.you && pending.actor_id === view.you;
  if (flip7SelectedTarget && !eligible.has(flip7SelectedTarget)) {
    flip7SelectedTarget = null;
  }
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (player.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (player.player_id === view.you) {
      card.classList.add("self");
    }
    const isEligible = eligible.has(player.player_id);
    if (pending && isEligible) {
      card.classList.add("flip7-target-eligible");
    }
    if (pending && isEligible && isPendingActor) {
      card.classList.add("flip7-target-selectable");
      card.addEventListener("click", () => {
        flip7SelectedTarget = player.player_id;
        updateFlip7TargetSelection(view);
        updateFlip7ActionButtons();
        renderFlip7Players(view);
        sendAction({ type: "choose_target", target_player_id: player.player_id });
      });
    }
    if (flip7SelectedTarget === player.player_id) {
      card.classList.add("flip7-target-selected");
    }
    if (player.status !== "active") {
      card.classList.add("disabled");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${player.score ?? 0}`;
    badges.appendChild(score);
    const status = document.createElement("span");
    status.className = "badge";
    const isBusted = player.status === "out" && player.round_score === 0;
    const displayStatus =
      isBusted ? "busted" : (player.status === "out" ? "out" : (player.status || "-"));
    status.textContent = displayStatus;
    if (isBusted) {
      status.classList.add("danger");
    }
    badges.appendChild(status);
    if (player.round_score !== null && player.round_score !== undefined) {
      const roundScore = document.createElement("span");
      roundScore.className = "badge";
      roundScore.textContent = `round ${player.round_score}`;
      badges.appendChild(roundScore);
    }
    if (player.flip7) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7flash";
      badges.appendChild(flip7);
    }
    if (player.has_second_chance) {
      const chance = document.createElement("span");
      chance.className = "badge";
      chance.textContent = "second chance";
      badges.appendChild(chance);
    }
    if (player.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (player.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    header.appendChild(badges);

    const tableauRow = document.createElement("div");
    tableauRow.className = "player-hand";
    if (Array.isArray(player.tableau) && player.tableau.length) {
      player.tableau.forEach((cardData) => {
        const slot = document.createElement("div");
        slot.className = "player-slot";
        slot.textContent = cardData.label || "?";
        tableauRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      tableauRow.appendChild(slot);
    }

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `numbers ${player.numbers_count ?? 0}`;

    card.appendChild(header);
    card.appendChild(tableauRow);
    card.appendChild(meta);
    if (player.player_id === view.you) {
      const actionsRow = document.createElement("div");
      actionsRow.className = "flip7-player-actions row actions";
      if (flip7FlipBtn) {
        actionsRow.appendChild(flip7FlipBtn);
      }
      if (flip7StayBtn) {
        actionsRow.appendChild(flip7StayBtn);
      }
      if (actionsRow.children.length) {
        card.appendChild(actionsRow);
      }
    }
    flip7Players.appendChild(card);
  });
}

function renderFlip7LastRound(view) {
  if (!flip7LastRound) {
    return;
  }
  flip7LastRound.innerHTML = "";
  const summary = view.last_round_summary;
  if (!summary) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No previous round yet.";
    flip7LastRound.appendChild(empty);
    return;
  }

  const meta = document.createElement("div");
  meta.className = "hint";
  const roundText = Number.isInteger(summary.round) ? `Round ${summary.round}` : "Last round";
  const reasonText = summary.reason ? ` (${summary.reason})` : "";
  meta.textContent = `${roundText}${reasonText}`;
  flip7LastRound.appendChild(meta);

  const flipsByPlayer = summary.flips || {};
  const statusByPlayer = summary.status || {};
  const roundScoresByPlayer = summary.round_scores || {};
  view.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name || player.player_id;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const status = statusByPlayer[player.player_id] || "-";
    const roundScore = roundScoresByPlayer[player.player_id];
    const isBusted = status === "out" && roundScore === 0;
    const displayStatus = isBusted ? "busted" : status;
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = displayStatus;
    if (isBusted) {
      statusBadge.classList.add("danger");
    }
    badges.appendChild(statusBadge);
    if (summary.flip7_winner === player.player_id) {
      const flip7 = document.createElement("span");
      flip7.className = "badge highlight";
      flip7.textContent = "flip7flash";
      badges.appendChild(flip7);
    }
    header.appendChild(badges);
    card.appendChild(header);

    const flipsRow = document.createElement("div");
    flipsRow.className = "player-hand";
    const flips = Array.isArray(flipsByPlayer[player.player_id])
      ? flipsByPlayer[player.player_id]
      : [];
    if (flips.length) {
      flips.forEach((flip) => {
        const slot = document.createElement("div");
        slot.className = "player-slot";
        const label = typeof flip === "string" ? flip : flip.label;
        slot.textContent = label || "?";
        flipsRow.appendChild(slot);
      });
    } else {
      const slot = document.createElement("div");
      slot.className = "player-slot empty";
      slot.textContent = "-";
      flipsRow.appendChild(slot);
    }

    card.appendChild(flipsRow);
    flip7LastRound.appendChild(card);
  });
}

function isFlip7ActionAvailable(actionType) {
  if (!currentFlip7View || !Array.isArray(currentFlip7View.legal_actions)) {
    return false;
  }
  if (!currentFlip7View.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "choose_target") {
    return !!flip7SelectedTarget;
  }
  return true;
}

function updateFlip7ActionButtons() {
  if (currentGameType !== "flip7") {
    Object.values(flip7ActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(flip7ActionButtons).forEach(([actionType, button]) => {
    const allowed = isFlip7ActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}
