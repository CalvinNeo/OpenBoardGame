function formatHalliFruit(fruit) {
  if (!fruit) {
    return "?";
  }
  return halliFruitEmoji[fruit] || fruit;
}

function formatHalliFruitList(fruits, totals = null) {
  if (!Array.isArray(fruits) || !fruits.length) {
    return "-";
  }
  return fruits
    .map((fruit) => {
      const emoji = formatHalliFruit(fruit);
      if (totals && Object.prototype.hasOwnProperty.call(totals, fruit)) {
        return `${emoji} ${totals[fruit]}`;
      }
      return emoji;
    })
    .join(", ");
}

function formatHalliCard(card) {
  if (!card) {
    return "-";
  }
  if (Array.isArray(card.fruits) && card.fruits.length) {
    const parts = card.fruits.map((entry) => {
      if (!entry) {
        return "?";
      }
      const emoji = formatHalliFruit(entry.fruit);
      const count = Number.isFinite(entry.count) ? entry.count : null;
      return count !== null ? `${emoji} ${count}` : emoji;
    });
    return parts.join(" + ");
  }
  const emoji = formatHalliFruit(card.fruit);
  const count = Number.isFinite(card.count) ? card.count : null;
  if (count !== null) {
    return `${emoji} ${count}`;
  }
  return emoji;
}

function formatHalliLastAction(view) {
  const last = view ? view.last_action : null;
  if (!last) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  if (last.type === "flip") {
    const card = last.card;
    const cardLabel = card ? formatHalliCard(card) : "card";
    return `${actor} flipped ${cardLabel}`;
  }
  if (last.type === "ring") {
    if (last.result === "success") {
      const fruits = formatHalliFruitList(last.bell_fruits);
      return `${actor} rang (success: ${fruits}, +${last.collected || 0} cards)`;
    }
    return `${actor} rang (false, penalty ${last.penalty_given || 0})`;
  }
  return "-";
}

function formatHalliLastRingResult(view) {
  const last = view ? view.last_ring_result : null;
  if (!last) {
    return "-";
  }
  const actor = last.player_id ? findPlayerName(view, last.player_id) : "Unknown";
  const fruits = formatHalliFruitList(last.fruits);
  if (last.result === "success") {
    return `${actor} success: ${fruits}`;
  }
  return `${actor} fail: ${fruits}`;
}

function halliNowMs() {
  return Date.now() + halliServerTimeOffsetMs;
}

function formatCountdownMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Ready";
  }
  if (ms < 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.ceil(ms / 1000)}s`;
}

function resetHalliCountdownLabels() {
  if (halliFlipCountdownLabel) {
    halliFlipCountdownLabel.textContent = "-";
    halliFlipCountdownLabel.classList.remove("halli-countdown-active");
  }
  if (halliRingCountdownLabel) {
    halliRingCountdownLabel.textContent = "-";
    halliRingCountdownLabel.classList.remove("halli-countdown-active");
  }
}

function startHalliCountdownTimer() {
  if (halliCountdownTimer || (!halliFlipCountdownLabel && !halliRingCountdownLabel)) {
    return;
  }
  halliCountdownTimer = window.setInterval(() => {
    if (currentGameType !== "halli_galli") {
      stopHalliCountdownTimer();
      return;
    }
    updateHalliCountdownLabels();
  }, 200);
}

function stopHalliCountdownTimer() {
  if (!halliCountdownTimer) {
    return;
  }
  window.clearInterval(halliCountdownTimer);
  halliCountdownTimer = null;
}

function updateHalliCountdownState(view) {
  if (!view) {
    halliCountdownState = {
      flipReadyAtMs: 0,
      ringReadyAtMs: 0,
      ringPending: false,
      turnSwitchAtMs: 0,
      flipWaitMs: 0,
    };
    halliServerTimeOffsetMs = 0;
    stopHalliCountdownTimer();
    resetHalliCountdownLabels();
    return;
  }
  const serverNow = Number(view.server_now_ms);
  if (Number.isFinite(serverNow)) {
    halliServerTimeOffsetMs = serverNow - Date.now();
  }
  const flipReadyAtMs = Number(view.flip_ready_at_ms);
  const flipWaitMs = view.config ? Number(view.config.flip_wait_ms) : 0;
  const pending = view.pending_flip;
  const ringReadyAtMs = pending ? Number(pending.reveal_at_ms) : 0;
  const turnSwitchAtMs = Number(view.turn_switch_at_ms);
  halliCountdownState = {
    flipReadyAtMs: Number.isFinite(flipReadyAtMs) ? flipReadyAtMs : 0,
    ringReadyAtMs: Number.isFinite(ringReadyAtMs) ? ringReadyAtMs : 0,
    ringPending: !!pending,
    turnSwitchAtMs: Number.isFinite(turnSwitchAtMs) ? turnSwitchAtMs : 0,
    flipWaitMs: Number.isFinite(flipWaitMs) ? Math.max(flipWaitMs, 0) : 0,
  };
  startHalliCountdownTimer();
  updateHalliCountdownLabels();
}

function updateHalliCountdownLabels() {
  if (!currentHalliView || currentGameType !== "halli_galli") {
    resetHalliCountdownLabels();
    return;
  }
  const now = halliNowMs();
  const flipRemaining =
    halliCountdownState.flipReadyAtMs > 0 ? halliCountdownState.flipReadyAtMs - now : 0;
  const ringRemaining =
    halliCountdownState.ringReadyAtMs > 0 ? halliCountdownState.ringReadyAtMs - now : 0;
  const ringWindowRemaining =
    halliCountdownState.turnSwitchAtMs > 0 ? halliCountdownState.turnSwitchAtMs - now : 0;

  if (halliFlipCountdownLabel) {
    halliFlipCountdownLabel.textContent = "-";
    halliFlipCountdownLabel.classList.remove("halli-countdown-active");
  }

  if (halliRingCountdownLabel) {
    let label = "Ready";
    let active = false;
    if (halliCountdownState.ringPending && ringRemaining > 0) {
      label = formatCountdownMs(ringRemaining);
      active = true;
    }
    halliRingCountdownLabel.textContent = label;
    halliRingCountdownLabel.classList.toggle("halli-countdown-active", active);
  }
  if (halliBellCountdown) {
    const show = !halliCountdownState.ringPending && ringWindowRemaining > 0 && isHalliActionAvailable("ring");
    if (show) {
      halliBellCountdown.textContent = formatCountdownMs(ringWindowRemaining);
      halliBellCountdown.classList.remove("hidden");
    } else {
      halliBellCountdown.textContent = "-";
      halliBellCountdown.classList.add("hidden");
    }
  }
}

function renderHalliPlayers(view) {
  if (!halliPlayers) {
    return;
  }
  halliPlayers.innerHTML = "";
  view.players.forEach((p, index) => {
    const card = document.createElement("div");
    card.className = "player-card halli-player-card";
    card.dataset.playerId = String(p.player_id ?? "");
    const seatIndex = (index % 8) + 1;
    card.classList.add(`halli-seat-${seatIndex}`);
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }
    if (p.eliminated) {
      card.classList.add("disabled");
    }
    if (p.player_id === view.you) {
      const flipAllowed = currentGameType === "halli_galli" && isHalliActionAvailable("flip");
      card.classList.add("halli-self-seat");
      card.classList.toggle("halli-self-actionable", flipAllowed);
      card.classList.toggle("halli-self-disabled", !flipAllowed);
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Flip");
      card.setAttribute("aria-disabled", (!flipAllowed).toString());
      const triggerFlip = () => {
        if (!flipAllowed) {
          return;
        }
        sendAction({ type: "flip" });
      };
      card.addEventListener("click", triggerFlip);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          triggerFlip();
        }
      });
    }
    const info = document.createElement("div");
    info.className = "halli-player-info";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    info.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges halli-player-badges";
    const handBadge = document.createElement("span");
    handBadge.className = "badge";
    handBadge.textContent = `hand ${p.hand_count}`;
    badges.appendChild(handBadge);
    const pileBadge = document.createElement("span");
    pileBadge.className = "badge";
    pileBadge.textContent = `pile ${p.pile_count}`;
    badges.appendChild(pileBadge);
    if (p.player_id === view.you) {
      const youBadge = document.createElement("span");
      youBadge.className = "badge";
      youBadge.textContent = "you";
      badges.appendChild(youBadge);
    }
    if (p.is_bot) {
      const botBadge = document.createElement("span");
      botBadge.className = "badge";
      botBadge.textContent = "bot";
      badges.appendChild(botBadge);
    }
    if (p.eliminated) {
      const outBadge = document.createElement("span");
      outBadge.className = "badge";
      outBadge.textContent = "out";
      badges.appendChild(outBadge);
    }

    info.appendChild(badges);
    card.appendChild(info);

    const topCard = document.createElement("div");
    topCard.className = "halli-player-topcard";
    topCard.textContent = formatHalliCard(p.top_card);
    card.appendChild(topCard);
    halliPlayers.appendChild(card);
  });
}

function isHalliActionAvailable(actionType) {
  if (!currentHalliView || !Array.isArray(currentHalliView.legal_actions)) {
    return false;
  }
  return currentHalliView.legal_actions.includes(actionType);
}

function updateHalliActionButtons() {
  if (currentGameType !== "halli_galli") {
    Object.values(halliActionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    if (halliBellCenter) {
      halliBellCenter.classList.remove("halli-bell-center-actionable");
      halliBellCenter.classList.add("halli-bell-center-disabled");
      halliBellCenter.setAttribute("aria-disabled", "true");
    }
    return;
  }
  Object.entries(halliActionButtons).forEach(([actionType, button]) => {
    const allowed = isHalliActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
  if (halliBellCenter) {
    const ringAllowed = isHalliActionAvailable("ring");
    halliBellCenter.classList.toggle("halli-bell-center-actionable", ringAllowed);
    halliBellCenter.classList.toggle("halli-bell-center-disabled", !ringAllowed);
    halliBellCenter.setAttribute("aria-disabled", (!ringAllowed).toString());
  }
}
