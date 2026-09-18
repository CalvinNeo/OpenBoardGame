(() => {
  "use strict";

  let wriggleRouletteView = null;
  let wriggleRoulettePending = false;
  let wriggleRoulettePendingTimer = null;
  let wriggleRouletteExplainMode = false;
  let wriggleRouletteLastAnnouncement = "";

  const panel = document.getElementById("wriggleRoulettePanel");
  const headerActions = document.getElementById("wriggleRouletteHeaderActions");
  const helpBtn = document.getElementById("wriggleRouletteHelpBtn");
  const explainBtn = document.getElementById("wriggleRouletteExplainBtn");
  const helpModal = document.getElementById("wriggleRouletteHelpModal");
  const explainModal = document.getElementById("wriggleRouletteExplainModal");
  const helpCloseBtn = document.getElementById("wriggleRouletteHelpCloseBtn");
  const explainCloseBtn = document.getElementById("wriggleRouletteExplainCloseBtn");
  const helpContent = document.getElementById("wriggleRouletteHelpContent");
  const explainContent = document.getElementById("wriggleRouletteExplainContent");
  const roundLabel = document.getElementById("wriggleRouletteRound");
  const cycleLabel = document.getElementById("wriggleRouletteCycle");
  const status = document.getElementById("wriggleRouletteStatus");
  const bagPrivacy = document.getElementById("wriggleRouletteBagPrivacy");
  const bagCount = document.getElementById("wriggleRouletteBagCount");
  const snakeCount = document.getElementById("wriggleRouletteSnakeCount");
  const threshold = document.getElementById("wriggleRouletteThreshold");
  const snakePips = document.getElementById("wriggleRouletteSnakePips");
  const playersEl = document.getElementById("wriggleRoulettePlayers");
  const reveal = document.getElementById("wriggleRouletteReveal");
  const revealKicker = document.getElementById("wriggleRouletteRevealKicker");
  const revealHeading = document.getElementById("wriggleRouletteRevealHeading");
  const revealSnakeTotal = document.getElementById("wriggleRouletteRevealSnakeTotal");
  const revealResults = document.getElementById("wriggleRouletteRevealResults");
  const actionDock = document.getElementById("wriggleRouletteActionDock");
  const actionHeading = document.getElementById("wriggleRouletteActionHeading");
  const actionHint = document.getElementById("wriggleRouletteActionHint");
  const grabButtons = document.getElementById("wriggleRouletteGrabButtons");
  const reviewBtn = document.getElementById("wriggleRouletteReviewBtn");
  const roundResult = document.getElementById("wriggleRouletteRoundResult");
  const roundResultHeading = document.getElementById("wriggleRouletteRoundResultHeading");
  const reviewProgress = document.getElementById("wriggleRouletteReviewProgress");
  const roundRows = document.getElementById("wriggleRouletteRoundRows");
  const logEl = document.getElementById("wriggleRouletteLog");
  const liveRegion = document.getElementById("wriggleRouletteLiveRegion");

  const EXPLANATIONS = {
    marsh: {
      title: "The Public Marsh",
      body: "The bag and outbreak meter are shared information. During secret choices, the bag count stays frozen at the start-of-grab value so earlier choices reveal no clues.",
    },
    bag: {
      title: "The Bag",
      body: "The bag begins with 51 eels and 17 snakes. Choose a number, then the server secretly draws up to that many pieces. Choosing zero banks your round eels and leaves the round.",
    },
    snakes: {
      title: "Outbreak Meter",
      body: "Every revealed snake remains in the center. If center snakes plus the newly drawn snakes reach the marked limit, an outbreak ends the round.",
    },
    players: {
      title: "Fishers and Hauls",
      body: "🪱 shows eels currently waiting in front of a player. They are not safe until that player chooses zero or survives the final outbreak. ⭐ is the banked total.",
    },
    reveal: {
      title: "Simultaneous Reveal",
      body: "All hands in a grab are revealed together. During an outbreak, every player tied for the largest actual hand loses their unbanked round haul; the other active players bank theirs.",
    },
    choices: {
      title: "Choose a Handful",
      body: "In a 2-player game choose 0–6; with 3–8 players choose 0–4. Your chosen number is private until the reveal. A choice is final when clicked.",
    },
    review: {
      title: "Review Confirmation",
      body: "After an ordinary reveal, active human players confirm before the next grab. After a round, every human player confirms before the marsh resets.",
    },
    round: {
      title: "Round Settlement",
      body: "The game checks 20 points only after a full round. A score tie goes to the player who left later in the final round; players leaving in the same grab remain co-winners.",
    },
    log: {
      title: "Marsh Log",
      body: "The log records locks, public reveals, settlements, and confirmations. Secret choice counts and hidden bag order never appear here.",
    },
  };

  const HELP_HTML = `
    <div class="wriggle-roulette-rules">
      <p class="wriggle-roulette-rule-lead"><strong>Fill your boat with eels, then get out before the snakes swarm.</strong> Wriggle Roulette is a 2–8 player secret-grab push-your-luck game.</p>
      <h3>Goal</h3>
      <p>Bank at least <strong>20 eels</strong>. The game ends after the current round, then the highest score wins.</p>
      <h3>A grab</h3>
      <ol>
        <li>Starting with the highlighted player, each active player secretly chooses a handful size.</li>
        <li>In a 2-player game choose <strong>0–6</strong>; with 3–8 players choose <strong>0–4</strong>.</li>
        <li>After everyone has chosen, all hands open together. Eels stay in front of their owners; snakes move to the center.</li>
      </ol>
      <div class="wriggle-roulette-rule-grid">
        <article><span aria-hidden="true">0️⃣</span><strong>Choose zero</strong><p>Bank every eel in front of you, return those eel pieces to the bag, and leave this round safely.</p></article>
        <article><span aria-hidden="true">🪱</span><strong>Draw eels</strong><p>Add them to your public round haul. They remain at risk while you stay in.</p></article>
        <article><span aria-hidden="true">🐍</span><strong>Draw snakes</strong><p>Add them to the center. The outbreak limit is 6 / 7 / 9 / 11 / 13 / 15 / 17 for 2–8 players.</p></article>
      </div>
      <h3>Snake outbreak</h3>
      <p>If the center and newly revealed hands reach the outbreak limit, compare each active player's <strong>actual hand size</strong>, eels and snakes together. Every player tied for the largest hand busts and loses their unbanked round eels. All other active players bank their round eels plus the eels just drawn. Players who left earlier keep their points.</p>
      <h3>Next grab and next round</h3>
      <p>The last player in the grab leads the next one if still active; otherwise the next active player clockwise leads. The last player in the round's final grab starts the next round.</p>
      <h3>Winning ties</h3>
      <p>When one or more players have 20 points after a round, highest score wins. Tied players compare when they left that final round: later is better. A tie from the same grab produces co-winners.</p>
      <p class="wriggle-roulette-scope-note"><strong>Digital ruling:</strong> buttons draw an exact legal number, so the tabletop rule for accidentally taking too many pieces is unnecessary.</p>
    </div>`;

  function setModal(modal, visible, returnFocus = null) {
    if (!modal) return;
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      const close = modal.querySelector("button");
      if (close) window.setTimeout(() => close.focus(), 0);
    } else if (returnFocus) {
      returnFocus.focus();
    }
  }

  function hasAction(actionType) {
    return Boolean(wriggleRouletteView && (wriggleRouletteView.legal_actions || []).includes(actionType));
  }

  function player(view, playerId) {
    return (view.players || []).find((item) => item.player_id === playerId) || null;
  }

  function playerName(view, playerId) {
    const item = player(view, playerId);
    return item ? item.name || item.player_id : playerId || "-";
  }

  function dispatch(action) {
    if (wriggleRoulettePending) return;
    wriggleRoulettePending = true;
    if (wriggleRoulettePendingTimer) window.clearTimeout(wriggleRoulettePendingTimer);
    wriggleRoulettePendingTimer = window.setTimeout(() => {
      wriggleRoulettePending = false;
      wriggleRoulettePendingTimer = null;
      if (wriggleRouletteView) renderActions(wriggleRouletteView);
    }, 2500);
    if (typeof sendAction === "function") sendAction(action);
    if (wriggleRouletteView) renderActions(wriggleRouletteView);
  }

  function makeChip(text, className = "") {
    const chip = document.createElement("span");
    chip.className = `wriggle-roulette-chip ${className}`.trim();
    chip.textContent = text;
    return chip;
  }

  function renderStatus(view) {
    if (!status) return;
    let copy = "Waiting for the marsh…";
    status.className = "wriggle-roulette-status";
    if (view.phase === "choosing") {
      const current = playerName(view, view.current_player_id);
      if (view.current_player_id === view.you && hasAction("grab")) {
        copy = "Your turn — choose a secret handful.";
        status.classList.add("is-your-turn");
      } else if (view.your_pending_count !== null && view.your_pending_count !== undefined) {
        copy = `Your choice is locked. ${current} is choosing now.`;
      } else {
        copy = `${current} is choosing a secret handful.`;
      }
    } else if (view.phase === "reveal_review") {
      copy = hasAction("ready_reveal")
        ? "Review the open hands, then confirm when ready."
        : "The hands are open. Waiting for active fishers to confirm.";
    } else if (view.phase === "round_review") {
      const reason = view.round_summary && view.round_summary.outbreak ? "The snakes swarmed." : "Every fisher banked safely.";
      copy = `${reason} Review the settlement before the next round.`;
      status.classList.add(view.round_summary && view.round_summary.outbreak ? "is-danger" : "is-safe");
    } else if (view.phase === "game_over") {
      const names = (view.winner_ids || []).map((id) => playerName(view, id)).join(" & ");
      copy = `${names || "The leading fisher"} won the night!`;
      status.classList.add("is-winner");
    }
    status.textContent = copy;
  }

  function renderMarsh(view) {
    if (bagCount) bagCount.textContent = String(Number(view.bag_count || 0));
    if (snakeCount) snakeCount.textContent = String(Number(view.center_snakes || 0));
    if (threshold) threshold.textContent = String(Number(view.outbreak_threshold || 0));
    if (bagPrivacy) {
      bagPrivacy.textContent = view.bag_hidden_during_choices ? "🔒 Count frozen while choosing" : "🔓 Reveal complete";
      bagPrivacy.classList.toggle("is-hidden", Boolean(view.bag_hidden_during_choices));
    }
    if (!snakePips) return;
    snakePips.innerHTML = "";
    const limit = Number(view.outbreak_threshold || 0);
    const snakes = Number(view.center_snakes || 0);
    for (let index = 0; index < limit; index += 1) {
      const pip = document.createElement("span");
      pip.className = "wriggle-roulette-snake-pip";
      pip.classList.toggle("is-filled", index < snakes);
      pip.classList.toggle("is-limit", index === limit - 1);
      pip.textContent = index < snakes ? "🐍" : "·";
      pip.setAttribute("aria-hidden", "true");
      snakePips.appendChild(pip);
    }
    snakePips.setAttribute("aria-label", `${snakes} of ${limit} snakes toward outbreak`);
  }

  function statusLabel(item) {
    if (item.busted) return "💥 Busted";
    if (item.status === "withdrawn") return "🛶 Banked";
    if (item.status === "round_done") return "✓ Settled";
    if (item.locked) return "🔒 Locked";
    return "🌊 Fishing";
  }

  function renderPlayers(view) {
    if (!playersEl) return;
    playersEl.innerHTML = "";
    (view.players || []).forEach((item) => {
      const card = document.createElement("article");
      card.className = "wriggle-roulette-player";
      if (item.player_id === view.you) card.classList.add("is-you");
      if (item.player_id === view.current_player_id) card.classList.add("is-current");
      if (item.status === "withdrawn") card.classList.add("is-withdrawn");
      if (item.busted) card.classList.add("is-busted");

      const heading = document.createElement("div");
      heading.className = "wriggle-roulette-player-heading";
      const name = document.createElement("strong");
      name.textContent = `${item.is_bot ? "🤖 " : ""}${item.name || item.player_id}${item.player_id === view.you ? " · You" : ""}`;
      const badge = document.createElement("span");
      badge.textContent = statusLabel(item);
      heading.append(name, badge);

      const haul = document.createElement("div");
      haul.className = "wriggle-roulette-player-haul";
      haul.append(makeChip(`🪱 ${Number(item.round_eels || 0)}`, "is-eel"), makeChip(`⭐ ${Number(item.score || 0)}`, "is-score"));
      card.append(heading, haul);
      playersEl.appendChild(card);
    });
  }

  function renderReveal(view) {
    const data = view.last_reveal;
    const visible = Boolean(data);
    if (reveal) reveal.classList.toggle("hidden", !visible);
    if (!visible || !revealResults) return;
    const outbreak = data.outcome === "outbreak";
    if (revealKicker) revealKicker.textContent = outbreak ? "Snake outbreak" : "Hands open";
    if (revealHeading) revealHeading.textContent = outbreak ? "The Marsh Erupts" : "Grab Reveal";
    if (revealSnakeTotal) {
      revealSnakeTotal.textContent = `🐍 ${Number(data.center_snakes_after || 0)} / ${Number(data.outbreak_threshold || 0)}`;
      revealSnakeTotal.classList.toggle("is-danger", outbreak);
    }
    reveal.classList.toggle("is-outbreak", outbreak);
    revealResults.innerHTML = "";
    (data.results || []).forEach((row) => {
      const card = document.createElement("article");
      card.className = "wriggle-roulette-reveal-card";
      if (row.busted) card.classList.add("is-busted");
      if (row.withdrew) card.classList.add("is-withdrawn");
      const name = document.createElement("strong");
      name.textContent = playerName(view, row.player_id);
      const pieces = document.createElement("div");
      pieces.className = "wriggle-roulette-reveal-pieces";
      pieces.append(makeChip(`🪱 ${Number(row.eels || 0)}`, "is-eel"), makeChip(`🐍 ${Number(row.snakes || 0)}`, "is-snake"));
      const outcome = document.createElement("span");
      outcome.className = "wriggle-roulette-reveal-outcome";
      if (row.busted) outcome.textContent = "Largest hand · lost the round haul";
      else if (row.withdrew) outcome.textContent = `Banked ${Number(row.banked || 0)}`;
      else if (outbreak) outcome.textContent = `Survived · banked ${Number(row.banked || 0)}`;
      else outcome.textContent = `${Number(row.actual_count || 0)} pieces drawn`;
      card.append(name, pieces, outcome);
      revealResults.appendChild(card);
    });
  }

  function renderRoundResult(view) {
    const summary = view.round_summary;
    const visible = Boolean(summary) && (view.phase === "round_review" || view.phase === "game_over");
    if (roundResult) roundResult.classList.toggle("hidden", !visible);
    if (!visible || !roundRows) return;
    if (roundResultHeading) {
      if (view.phase === "game_over") roundResultHeading.textContent = "Final Haul";
      else roundResultHeading.textContent = summary.outbreak ? "Outbreak Settlement" : "Safe Settlement";
    }
    let done = Number((view.review_progress && view.review_progress.done) || 0);
    const total = Number((view.review_progress && view.review_progress.total) || 0);
    if (view.phase === "game_over") {
      const required = new Set(view.review_required || []);
      done = (view.players || []).filter((item) => required.has(item.player_id) && item.rematch_ready).length;
    }
    if (reviewProgress) reviewProgress.textContent = `${done} / ${total} ready`;
    roundRows.innerHTML = "";
    (summary.players || []).forEach((row) => {
      const item = document.createElement("div");
      item.className = "wriggle-roulette-round-row";
      if (row.busted) item.classList.add("is-busted");
      if ((view.winner_ids || []).includes(row.player_id)) item.classList.add("is-winner");
      const label = document.createElement("strong");
      label.textContent = playerName(view, row.player_id);
      const detail = document.createElement("span");
      detail.textContent = row.busted
        ? `💥 +0 this round · ⭐ ${Number(row.total_score || 0)}`
        : `🪱 +${Number(row.round_points || 0)} · ⭐ ${Number(row.total_score || 0)} · exit ${Number(row.exit_wave || 0)}`;
      item.append(label, detail);
      roundRows.appendChild(item);
    });
  }

  function renderActions(view) {
    if (!actionDock || !grabButtons || !reviewBtn) return;
    const choosing = view.phase === "choosing";
    actionDock.classList.toggle("is-review", !choosing);
    grabButtons.classList.toggle("hidden", !choosing);
    reviewBtn.classList.toggle("hidden", choosing);

    if (choosing) {
      if (actionHeading) actionHeading.textContent = view.your_pending_count === null || view.your_pending_count === undefined ? "Choose a handful" : "Choice locked";
      if (actionHint) {
        if (view.your_pending_count !== null && view.your_pending_count !== undefined) {
          actionHint.textContent = `You chose ${view.your_pending_count}. The contents remain secret until the reveal.`;
        } else if (hasAction("grab")) {
          actionHint.textContent = "Choose 0 to bank and leave, or risk another hidden handful.";
        } else {
          actionHint.textContent = `Waiting for ${playerName(view, view.current_player_id)} to lock a choice.`;
        }
      }
      grabButtons.innerHTML = "";
      for (let count = 0; count <= Number(view.grab_max || 4); count += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wriggle-roulette-grab-btn";
        button.dataset.wriggleRouletteExplain = "choices";
        if (count === 0) {
          button.classList.add("is-bank");
          button.innerHTML = '<span aria-hidden="true">🛶</span><strong>0</strong><small>Bank &amp; leave</small>';
        } else {
          button.innerHTML = `<span aria-hidden="true">🫴</span><strong>${count}</strong><small>${count === 1 ? "piece" : "pieces"}</small>`;
        }
        button.disabled = wriggleRoulettePending || !hasAction("grab");
        button.addEventListener("click", () => {
          if (!hasAction("grab") || wriggleRoulettePending) return;
          dispatch({ type: "grab", count, cycle_no: view.cycle_no });
        });
        grabButtons.appendChild(button);
      }
      return;
    }

    reviewBtn.disabled = wriggleRoulettePending;
    if (view.phase === "reveal_review") {
      if (actionHeading) actionHeading.textContent = "Review the open hands";
      if (actionHint) actionHint.textContent = "Withdrawn fishers can watch; only active human fishers must confirm.";
      reviewBtn.textContent = hasAction("ready_reveal") ? "Ready for Next Grab" : "Waiting for Active Fishers…";
      reviewBtn.disabled = wriggleRoulettePending || !hasAction("ready_reveal");
    } else if (view.phase === "round_review") {
      if (actionHeading) actionHeading.textContent = "Round complete";
      if (actionHint) actionHint.textContent = "The next round begins after every human fisher confirms.";
      reviewBtn.textContent = hasAction("next_round") ? "Next Round" : "Ready · Waiting for Others…";
      reviewBtn.disabled = wriggleRoulettePending || !hasAction("next_round");
    } else {
      if (actionHeading) actionHeading.textContent = "Night complete";
      if (actionHint) actionHint.textContent = "Every human fisher confirms before a fresh game begins.";
      reviewBtn.textContent = hasAction("play_again") ? "Play Again" : "Ready · Waiting for Others…";
      reviewBtn.disabled = wriggleRoulettePending || !hasAction("play_again");
    }
  }

  function renderLog(view) {
    if (!logEl) return;
    const entries = [...(view.activity || [])].reverse();
    logEl.innerHTML = "";
    if (!entries.length) {
      logEl.textContent = "No actions yet.";
      return;
    }
    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "wriggle-roulette-log-row";
      const marker = document.createElement("span");
      marker.textContent = entry.type === "reveal" ? "🫴" : entry.type === "round_end" ? "🌙" : entry.type.includes("ready") ? "✓" : "•";
      const message = document.createElement("span");
      message.textContent = entry.message || entry.type;
      row.append(marker, message);
      logEl.appendChild(row);
    });
  }

  function announce(view) {
    if (!liveRegion) return;
    let message = "";
    if (view.last_reveal) {
      message = view.last_reveal.outcome === "outbreak"
        ? `Snake outbreak with ${view.last_reveal.center_snakes_after} snakes.`
        : `Grab ${view.last_reveal.cycle_no} revealed.`;
    } else if (view.phase === "game_over") {
      message = `${(view.winner_ids || []).map((id) => playerName(view, id)).join(" and ")} won Wriggle Roulette.`;
    }
    if (message && message !== wriggleRouletteLastAnnouncement) {
      wriggleRouletteLastAnnouncement = message;
      liveRegion.textContent = message;
    }
  }

  function renderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    wriggleRouletteView = view;
    wriggleRoulettePending = false;
    if (wriggleRoulettePendingTimer) window.clearTimeout(wriggleRoulettePendingTimer);
    wriggleRoulettePendingTimer = null;
    if (typeof currentGameType !== "undefined" && currentGameType !== "wriggle_roulette") {
      currentGameType = "wriggle_roulette";
      setGamePanelVisibility("wriggle_roulette");
    }
    if (roundLabel) roundLabel.textContent = String(Number(view.round_no || 1));
    if (cycleLabel) cycleLabel.textContent = String(Number(view.cycle_no || 1));
    renderStatus(view);
    renderMarsh(view);
    renderPlayers(view);
    renderReveal(view);
    renderRoundResult(view);
    renderActions(view);
    renderLog(view);
    refreshExplainTargets();
    announce(view);
  }

  function setExplainMode(enabled) {
    wriggleRouletteExplainMode = Boolean(enabled);
    document.body.classList.toggle("wriggle-roulette-explain-mode", wriggleRouletteExplainMode);
    if (explainBtn) explainBtn.setAttribute("aria-pressed", wriggleRouletteExplainMode ? "true" : "false");
    document.querySelectorAll("[data-wriggle-roulette-explain]").forEach((element) => {
      element.classList.toggle("has-explanation", wriggleRouletteExplainMode);
    });
  }

  function refreshExplainTargets() {
    if (!wriggleRouletteExplainMode) return;
    document.querySelectorAll("[data-wriggle-roulette-explain]").forEach((element) => element.classList.add("has-explanation"));
  }

  function showExplanation(target) {
    if (!target || !explainContent) return;
    const copy = EXPLANATIONS[target.dataset.wriggleRouletteExplain];
    if (!copy) return;
    explainContent.innerHTML = "";
    const heading = document.createElement("h3");
    heading.textContent = copy.title;
    const body = document.createElement("p");
    body.textContent = copy.body;
    explainContent.append(heading, body);
    setModal(explainModal, true);
  }

  function findDisabledExplainTarget(x, y) {
    const targets = document.querySelectorAll("button[data-wriggle-roulette-explain]:disabled");
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return target;
    }
    return null;
  }

  function clearState() {
    wriggleRouletteView = null;
    wriggleRoulettePending = false;
    wriggleRouletteLastAnnouncement = "";
    if (wriggleRoulettePendingTimer) window.clearTimeout(wriggleRoulettePendingTimer);
    wriggleRoulettePendingTimer = null;
    setExplainMode(false);
    setModal(helpModal, false);
    setModal(explainModal, false);
    if (status) status.textContent = "Waiting for game state…";
  }

  function showHeaderActions(show) {
    if (headerActions) headerActions.style.display = show ? "flex" : "none";
    if (!show) {
      setExplainMode(false);
      setModal(helpModal, false);
      setModal(explainModal, false);
    }
  }

  if (helpContent) helpContent.innerHTML = HELP_HTML;
  if (helpBtn) helpBtn.addEventListener("click", () => setModal(helpModal, true));
  if (explainBtn) explainBtn.addEventListener("click", () => setExplainMode(!wriggleRouletteExplainMode));
  if (helpCloseBtn) helpCloseBtn.addEventListener("click", () => setModal(helpModal, false, helpBtn));
  if (explainCloseBtn) explainCloseBtn.addEventListener("click", () => setModal(explainModal, false));
  if (reviewBtn) {
    reviewBtn.addEventListener("click", () => {
      if (!wriggleRouletteView || wriggleRoulettePending) return;
      if (hasAction("ready_reveal")) dispatch({ type: "ready_reveal", cycle_no: wriggleRouletteView.cycle_no });
      else if (hasAction("next_round")) dispatch({ type: "next_round", round_no: wriggleRouletteView.round_no });
      else if (hasAction("play_again")) dispatch({ type: "play_again" });
    });
  }

  [helpModal, explainModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) setModal(modal, false, modal === helpModal ? helpBtn : null);
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!wriggleRouletteExplainMode || typeof currentGameType === "undefined" || currentGameType !== "wriggle_roulette") return;
      const button = event.target.closest("button");
      if ([helpBtn, explainBtn, helpCloseBtn, explainCloseBtn].includes(button)) return;
      const target = event.target.closest("[data-wriggle-roulette-explain]");
      if (button || (target && panel && panel.contains(target))) {
        event.preventDefault();
        event.stopPropagation();
        if (target) {
          showExplanation(target);
          setExplainMode(false);
        }
        return;
      }
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!wriggleRouletteExplainMode || typeof currentGameType === "undefined" || currentGameType !== "wriggle_roulette") return;
      const target = findDisabledExplainTarget(event.clientX, event.clientY);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      showExplanation(target);
      setExplainMode(false);
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (wriggleRouletteExplainMode) setExplainMode(false);
    if (helpModal && !helpModal.classList.contains("hidden")) setModal(helpModal, false, helpBtn);
    if (explainModal && !explainModal.classList.contains("hidden")) setModal(explainModal, false);
  });

  window.clearWriggleRouletteState = clearState;
  window.renderWriggleRouletteGameState = renderGameState;
  window.showWriggleRouletteHeaderActions = showHeaderActions;
})();
