(() => {
  "use strict";

  let hotStreakView = null;
  let hotStreakSelectedCards = new Set();
  let hotStreakPendingStack = null;
  let hotStreakPendingDouble = null;
  let hotStreakExplainMode = false;
  let hotStreakSuppressClick = false;
  let hotStreakAdvanceTimer = null;
  let hotStreakFallbackTimer = null;
  let hotStreakScheduledStep = null;

  const hotStreakPanel = document.getElementById("hotStreakPanel");
  const hotStreakHeaderActions = document.getElementById("hotStreakHeaderActions");
  const hotStreakHelpBtn = document.getElementById("hotStreakHelpBtn");
  const hotStreakExplainBtn = document.getElementById("hotStreakExplainBtn");
  const hotStreakRaceLabel = document.getElementById("hotStreakRaceLabel");
  const hotStreakPhaseLabel = document.getElementById("hotStreakPhaseLabel");
  const hotStreakTurnLabel = document.getElementById("hotStreakTurnLabel");
  const hotStreakDataNotice = document.getElementById("hotStreakDataNotice");
  const hotStreakPlayers = document.getElementById("hotStreakPlayers");
  const hotStreakTrack = document.getElementById("hotStreakTrack");
  const hotStreakCurrentCard = document.getElementById("hotStreakCurrentCard");
  const hotStreakSideBet = document.getElementById("hotStreakSideBet");
  const hotStreakPoolSection = document.getElementById("hotStreakPoolSection");
  const hotStreakPoolCount = document.getElementById("hotStreakPoolCount");
  const hotStreakPool = document.getElementById("hotStreakPool");
  const hotStreakTicketSection = document.getElementById("hotStreakTicketSection");
  const hotStreakTickets = document.getElementById("hotStreakTickets");
  const hotStreakDraftProgress = document.getElementById("hotStreakDraftProgress");
  const hotStreakHandSection = document.getElementById("hotStreakHandSection");
  const hotStreakHand = document.getElementById("hotStreakHand");
  const hotStreakHandHint = document.getElementById("hotStreakHandHint");
  const hotStreakSubmissionProgress = document.getElementById("hotStreakSubmissionProgress");
  const hotStreakSubmitBtn = document.getElementById("hotStreakSubmitBtn");
  const hotStreakContinueBtn = document.getElementById("hotStreakContinueBtn");
  const hotStreakNextRaceBtn = document.getElementById("hotStreakNextRaceBtn");
  const hotStreakPlayAgainBtn = document.getElementById("hotStreakPlayAgainBtn");
  const hotStreakResult = document.getElementById("hotStreakResult");
  const hotStreakLog = document.getElementById("hotStreakLog");
  const hotStreakBetModal = document.getElementById("hotStreakBetModal");
  const hotStreakBetModalTitle = document.getElementById("hotStreakBetModalTitle");
  const hotStreakBetModalBody = document.getElementById("hotStreakBetModalBody");
  const hotStreakBetModalCloseBtn = document.getElementById("hotStreakBetModalCloseBtn");
  const hotStreakHelpModal = document.getElementById("hotStreakHelpModal");
  const hotStreakHelpContent = document.getElementById("hotStreakHelpContent");
  const hotStreakHelpModalCloseBtn = document.getElementById("hotStreakHelpModalCloseBtn");
  const hotStreakExplainModal = document.getElementById("hotStreakExplainModal");
  const hotStreakExplainContent = document.getElementById("hotStreakExplainContent");
  const hotStreakExplainModalCloseBtn = document.getElementById("hotStreakExplainModalCloseBtn");

  const HOT_STREAK_PHASE_LABELS = {
    betting: "Betting",
    card_selection: "Choose Race Cards",
    race_countdown: "Starting Race",
    racing: "Race in Progress",
    race_result: "Race Results",
    game_over: "Final Results",
  };

  const HOT_STREAK_EXPLANATIONS = {
    pool: {
      name: "Public Race Pool",
      description:
        "These cards are already known before betting. Secret player additions are not shown here, so use this pool to judge which racers and effects are currently more likely.",
    },
    ticket: {
      name: "Betting Ticket",
      description:
        "Take the visible top ticket from this stack. You will then choose Safe or Risky. Tickets pay from the racer's finish or from the current YES/NO side bet.",
    },
    mode: {
      name: "Safe or Risky",
      description:
        "Safe gives a steadier payout. Risky offers a larger top payout and a wrong side bet can cost money. The choice is locked with the ticket.",
    },
    double: {
      name: "Double Bet",
      description:
        "During race three, choose one of your first two tickets to double. Both rewards and penalties are multiplied by two.",
    },
    hand: {
      name: "Race Card",
      description:
        "Secretly add this card to the race deck. Other players only learn that you submitted; they do not see which card you chose.",
    },
    submit: {
      name: "Submit Race Card",
      description:
        "Lock the selected card into the race deck. Choose one card in games with 3–8 players, or two cards in a two-player game.",
    },
    continue: {
      name: "Continue Race",
      description:
        "Reveal and resolve the next server-controlled race step. This appears as a fallback if automatic playback pauses.",
    },
    next: {
      name: "Next Race",
      description:
        "Mark yourself ready after reviewing the result. The next race begins only after every player is ready.",
    },
    again: {
      name: "Play Again",
      description: "Start a fresh three-race game with the same players.",
    },
  };

  const HOT_STREAK_HELP_HTML = `
    <div class="rules-block hot-streak-rules">
      <p class="hot-streak-help-notice"><strong>Prototype-compatible data.</strong> This digital implementation uses original artwork and an unverified playable component set. Card distribution, track coordinates, ticket payouts, and side-bet wording have not been checked against a physical second printing.</p>
      <p><strong>Goal.</strong> Build the biggest fortune across three chaotic races. Every player starts with 💵 $10.</p>
      <p><strong>Betting.</strong> Review the Public Race Pool first, then take two tickets in a snake draft (three each in a two-player game). Choose Safe or Risky immediately. Racer tickets pay by finishing place; YES and NO tickets predict the public side bet.</p>
      <p><strong>Build the race.</strong> The Public Race Pool shows every known base card, grouped by matching card face. Each player then secretly contributes one race card, or two cards in a two-player game, to make an 18-card race deck.</p>
      <p><strong>Race cards.</strong> Numbers move a racer in the direction it faces. ↩️ changes direction, 💫 knocks a racer down, recovery stands it up and faces it forward, and ⭐ moves it to the next star. A fallen racer only crawls one space.</p>
      <p><strong>Swerves and collisions.</strong> A swerve moves sideways relative to the racer's facing. A collision knocks a standing racer down; hitting a fallen racer knocks it out. Leaving the track also causes disqualification.</p>
      <p><strong>Everyone cards.</strong> Green-style all-racer cards resolve simultaneously, cause no collisions, and stop before the finish line.</p>
      <p><strong>Deck exhaustion.</strong> If no result is reached after the deck runs out, the rear edge folds forward. Racers caught behind it are disqualified, then all 18 cards are shuffled and three are burned again.</p>
      <p><strong>Race three.</strong> When you take your second ticket, double one of those bets. A doubled Risky penalty is doubled too.</p>
      <p><strong>Review.</strong> After races one and two, everyone must click Next Race before the track resets. After race three, the richest player wins; equal fortunes share the win.</p>
      <p><strong>Two-player changes.</strong> Each player holds four cards, takes three tickets, and contributes two cards per race.</p>
    </div>
  `;

  function hotStreakSetModal(modal, visible, focusTarget) {
    if (!modal) return;
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      const first = modal.querySelector("button, input, [tabindex]");
      if (first) window.setTimeout(() => first.focus(), 0);
    } else if (focusTarget) {
      focusTarget.focus();
    }
  }

  function hotStreakFindPlayer(view, playerId) {
    return (view.players || []).find((player) => player.player_id === playerId) || null;
  }

  function hotStreakPlayerName(view, playerId) {
    const player = hotStreakFindPlayer(view, playerId);
    return (player && player.name) || playerId || "-";
  }

  function hotStreakFindRacer(view, racerId) {
    return (view.racers || []).find((racer) => racer.racer_id === racerId) || null;
  }

  function hotStreakTargetLabel(view, target) {
    if (target === "yes") return "✅ YES";
    if (target === "no") return "❌ NO";
    const racer = hotStreakFindRacer(view, target);
    return racer ? `${racer.icon} ${racer.name}` : target;
  }

  function hotStreakHasAction(actionType) {
    return Boolean(
      hotStreakView &&
        Array.isArray(hotStreakView.legal_actions) &&
        hotStreakView.legal_actions.includes(actionType)
    );
  }

  function hotStreakMoney(value) {
    const amount = Number(value || 0);
    return `${amount >= 0 ? "" : "−"}💵${Math.abs(amount)}`;
  }

  function hotStreakFormatPayout(payout) {
    if (!payout) return "-";
    if (Object.prototype.hasOwnProperty.call(payout, "correct")) {
      return `Right ${hotStreakMoney(payout.correct)} · Wrong ${hotStreakMoney(payout.incorrect)}`;
    }
    return `🥇${hotStreakMoney(payout["1"])} · 🥈${hotStreakMoney(payout["2"])} · 🥉${hotStreakMoney(payout["3"])}`;
  }

  function hotStreakRenderPlayers(view) {
    if (!hotStreakPlayers) return;
    hotStreakPlayers.innerHTML = "";
    (view.players || []).forEach((player) => {
      const card = document.createElement("article");
      card.className = "hot-streak-player";
      if (player.player_id === view.you) card.classList.add("self");
      if (player.player_id === view.current_drafter) card.classList.add("current");

      const heading = document.createElement("div");
      heading.className = "hot-streak-player-heading";
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      const money = document.createElement("span");
      money.textContent = `💵 ${player.money}`;
      heading.append(name, money);

      const bets = document.createElement("div");
      bets.className = "hot-streak-player-bets";
      (player.bets || []).forEach((bet) => {
        const chip = document.createElement("span");
        chip.className = `hot-streak-bet-chip is-${bet.mode}`;
        chip.textContent = `${hotStreakTargetLabel(view, bet.target)} · ${bet.mode === "risky" ? "Risky" : "Safe"}${bet.doubled ? " · ×2" : ""}`;
        bets.appendChild(chip);
      });
      if (!(player.bets || []).length) {
        const empty = document.createElement("span");
        empty.className = "hint";
        empty.textContent = "No tickets yet";
        bets.appendChild(empty);
      }

      const status = document.createElement("div");
      status.className = "hot-streak-player-status";
      if (view.phase === "card_selection") {
        status.textContent = player.submitted ? `Submitted ${player.submitted_count} ✓` : "Choosing a card…";
      } else if (view.phase === "race_result") {
        status.textContent = player.ready ? "Ready ✓" : "Reviewing…";
      } else if (player.is_bot) {
        status.textContent = "Bot";
      }
      card.append(heading, bets, status);
      hotStreakPlayers.appendChild(card);
    });
  }

  function hotStreakRenderSideBet(view) {
    if (!hotStreakSideBet) return;
    hotStreakSideBet.innerHTML = "";
    const bet = view.current_side_bet || {};
    const prompt = document.createElement("strong");
    prompt.textContent = bet.label || "-";
    const tracker = view.side_bet_tracker || {};
    const result = document.createElement("span");
    result.className = "hot-streak-side-result";
    if (tracker.resolved) {
      result.textContent = tracker.result ? "YES ✓" : "NO ✕";
      result.classList.add(tracker.result ? "is-yes" : "is-no");
    } else {
      result.textContent = "Pending";
    }
    hotStreakSideBet.append(prompt, result);
  }

  function hotStreakRenderPool(view) {
    if (!hotStreakPool) return;
    const cards = Array.isArray(view.base_race_cards) ? view.base_race_cards : [];
    const groups = new Map();
    cards.forEach((card) => {
      const key = card.template_id || card.instance_id;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, {card, count: 1});
      }
    });

    hotStreakPool.innerHTML = "";
    if (hotStreakPoolCount) {
      hotStreakPoolCount.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;
    }
    if (!cards.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No public cards available.";
      hotStreakPool.appendChild(empty);
      return;
    }

    groups.forEach(({card, count}) => {
      const item = document.createElement("article");
      item.className = `hot-streak-pool-card${card.target === "all" ? " is-everyone" : ""}`;
      item.setAttribute("role", "listitem");
      item.title = `${card.target_name}: ${card.label}${count > 1 ? ` (${count} copies)` : ""}`;

      const target = document.createElement("span");
      target.className = "hot-streak-pool-target";
      target.textContent = `${card.target_icon} ${card.target_name}`;
      const label = document.createElement("strong");
      label.textContent = card.label;
      const meta = document.createElement("span");
      meta.className = "hot-streak-pool-meta";
      const details = [];
      if (card.starting) details.push("Starter");
      if (count > 1) details.push(`×${count}`);
      meta.textContent = details.join(" · ") || "Public";
      item.append(target, label, meta);
      hotStreakPool.appendChild(item);
    });
  }

  function hotStreakRenderTickets(view) {
    if (!hotStreakTickets) return;
    hotStreakTickets.innerHTML = "";
    const canDraft = hotStreakHasAction("draft_ticket") && view.current_drafter === view.you;
    (view.ticket_stacks || []).forEach((stack) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hot-streak-ticket";
      button.dataset.hotStreakExplain = "ticket";
      button.disabled = !canDraft || !stack.top;
      const heading = document.createElement("span");
      heading.className = "hot-streak-ticket-heading";
      heading.textContent = `${stack.icon} ${stack.label}`;
      const count = document.createElement("span");
      count.className = "hot-streak-ticket-count";
      count.textContent = `${stack.remaining} left`;
      const safe = document.createElement("span");
      safe.className = "hot-streak-ticket-line";
      safe.textContent = stack.top ? `Safe · ${hotStreakFormatPayout(stack.top.safe)}` : "Empty";
      const risky = document.createElement("span");
      risky.className = "hot-streak-ticket-line is-risky";
      risky.textContent = stack.top ? `Risky · ${hotStreakFormatPayout(stack.top.risky)}` : "";
      button.append(heading, count, safe, risky);
      button.addEventListener("click", () => hotStreakOpenBetModal(stack));
      hotStreakTickets.appendChild(button);
    });
    if (hotStreakDraftProgress) {
      const progress = view.draft_progress || {};
      hotStreakDraftProgress.textContent = `${progress.done || 0}/${progress.total || 0}`;
    }
  }

  function hotStreakNeedsDouble(view) {
    const me = hotStreakFindPlayer(view, view.you);
    return Boolean(
      view.race_number === 3 &&
        view.current_drafter === view.you &&
        me &&
        Array.isArray(me.bets) &&
        me.bets.length === 1
    );
  }

  function hotStreakOpenBetModal(stack) {
    if (!hotStreakView || !hotStreakHasAction("draft_ticket") || !stack || !stack.top) return;
    hotStreakPendingStack = stack;
    hotStreakPendingDouble = null;
    hotStreakRenderBetModal();
    hotStreakSetModal(hotStreakBetModal, true);
  }

  function hotStreakRenderBetModal() {
    if (!hotStreakBetModalBody || !hotStreakPendingStack || !hotStreakView) return;
    const stack = hotStreakPendingStack;
    hotStreakBetModalTitle.textContent = `${stack.icon} ${stack.label} · Tier ${stack.top.tier}`;
    hotStreakBetModalBody.innerHTML = "";

    if (hotStreakNeedsDouble(hotStreakView)) {
      const doubleBox = document.createElement("fieldset");
      doubleBox.className = "hot-streak-double-box";
      doubleBox.dataset.hotStreakExplain = "double";
      const legend = document.createElement("legend");
      legend.textContent = "Race 3: choose the bet to double";
      const me = hotStreakFindPlayer(hotStreakView, hotStreakView.you);
      const choices = (me.bets || []).map((bet) => ({
        id: bet.bet_id,
        label: hotStreakTargetLabel(hotStreakView, bet.target),
      }));
      choices.push({id: "new", label: `${stack.icon} ${stack.label} (new ticket)`});
      choices.forEach((choice) => {
        const label = document.createElement("label");
        label.className = "hot-streak-radio-label";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "hot-streak-double";
        input.value = choice.id;
        input.checked = hotStreakPendingDouble === choice.id;
        input.addEventListener("change", () => {
          hotStreakPendingDouble = choice.id;
        });
        label.append(input, document.createTextNode(choice.label));
        doubleBox.appendChild(label);
      });
      doubleBox.prepend(legend);
      hotStreakBetModalBody.appendChild(doubleBox);
    }

    const actions = document.createElement("div");
    actions.className = "hot-streak-mode-actions";
    ["safe", "risky"].forEach((mode) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `hot-streak-mode-button is-${mode}`;
      button.dataset.hotStreakExplain = "mode";
      const title = document.createElement("strong");
      title.textContent = mode === "safe" ? "🛡️ Safe" : "🔥 Risky";
      const payout = document.createElement("span");
      payout.textContent = hotStreakFormatPayout(stack.top[mode]);
      button.append(title, payout);
      button.addEventListener("click", () => hotStreakTakeTicket(mode));
      actions.appendChild(button);
    });
    hotStreakBetModalBody.appendChild(actions);
  }

  function hotStreakTakeTicket(mode) {
    if (!hotStreakPendingStack || !hotStreakView) return;
    const action = {
      type: "draft_ticket",
      stack_id: hotStreakPendingStack.stack_id,
      mode,
    };
    if (hotStreakNeedsDouble(hotStreakView)) {
      if (!hotStreakPendingDouble) {
        const message = document.createElement("p");
        message.className = "hot-streak-modal-error";
        message.textContent = "Choose which ticket to double first.";
        hotStreakBetModalBody.prepend(message);
        return;
      }
      action.double_bet_id = hotStreakPendingDouble;
    }
    sendAction(action);
    hotStreakSetModal(hotStreakBetModal, false);
    hotStreakPendingStack = null;
    hotStreakPendingDouble = null;
  }

  function hotStreakRenderHand(view) {
    if (!hotStreakHand) return;
    const hand = Array.isArray(view.your_hand) ? view.your_hand : [];
    const availableIds = new Set(hand.map((card) => card.instance_id));
    hotStreakSelectedCards = new Set(
      Array.from(hotStreakSelectedCards).filter((cardId) => availableIds.has(cardId))
    );
    hotStreakHand.innerHTML = "";
    const canSubmit = hotStreakHasAction("submit_race_cards");
    hand.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hot-streak-race-card";
      button.dataset.hotStreakExplain = "hand";
      button.disabled = !canSubmit;
      if (hotStreakSelectedCards.has(card.instance_id)) button.classList.add("selected");
      const target = document.createElement("span");
      target.className = "hot-streak-race-card-target";
      target.textContent = `${card.target_icon} ${card.target_name}`;
      const effect = document.createElement("strong");
      effect.textContent = card.label;
      button.append(target, effect);
      button.addEventListener("click", () => {
        const required = Number((view.submission_progress || {}).required_per_player || 1);
        if (hotStreakSelectedCards.has(card.instance_id)) {
          hotStreakSelectedCards.delete(card.instance_id);
        } else {
          if (hotStreakSelectedCards.size >= required) hotStreakSelectedCards.clear();
          hotStreakSelectedCards.add(card.instance_id);
        }
        hotStreakRenderHand(view);
      });
      hotStreakHand.appendChild(button);
    });
    const required = Number((view.submission_progress || {}).required_per_player || 1);
    if (hotStreakHandHint) {
      const me = hotStreakFindPlayer(view, view.you);
      hotStreakHandHint.textContent = me && me.submitted
        ? "Submitted. Your choice is locked."
        : `Choose ${required} race card${required === 1 ? "" : "s"}. Click the empty area to deselect.`;
    }
    if (hotStreakSubmissionProgress) {
      const progress = view.submission_progress || {};
      hotStreakSubmissionProgress.textContent = `${progress.done || 0}/${progress.total || 0}`;
    }
    if (hotStreakSubmitBtn) {
      hotStreakSubmitBtn.textContent = required === 1 ? "Submit Card" : "Submit 2 Cards";
      hotStreakSubmitBtn.disabled = !canSubmit || hotStreakSelectedCards.size !== required;
    }
  }

  function hotStreakRenderTrack(view) {
    if (!hotStreakTrack) return;
    hotStreakTrack.innerHTML = "";
    const track = view.track || {};
    const laneCount = Number(track.lane_count || 4);
    const finish = Number(track.finish_position || 13);
    const backEdge = Number(view.track_back_edge || 0);
    const racersByCell = new Map();
    (view.racers || []).forEach((racer) => {
      if (racer.status !== "active") return;
      const key = `${racer.lane}:${racer.position}`;
      if (!racersByCell.has(key)) racersByCell.set(key, []);
      racersByCell.get(key).push(racer);
    });
    for (let lane = 0; lane < laneCount; lane += 1) {
      const stars = new Set(((track.star_positions_by_lane || {})[String(lane)] || []).map(Number));
      for (let position = 0; position < finish; position += 1) {
        const cell = document.createElement("div");
        cell.className = "hot-streak-track-cell";
        cell.style.setProperty("--hot-streak-lane", lane);
        cell.style.setProperty("--hot-streak-position", position);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `Lane ${lane + 1}, space ${position + 1}`);
        if (position < backEdge) cell.classList.add("folded");
        if (position >= Number(track.final_stretch_start || 10)) cell.classList.add("final-stretch");
        if (position === finish - 1) cell.classList.add("finish-edge");
        if (stars.has(position)) {
          const star = document.createElement("span");
          star.className = "hot-streak-track-star";
          star.textContent = "⭐";
          star.setAttribute("aria-hidden", "true");
          cell.appendChild(star);
        }
        const markers = racersByCell.get(`${lane}:${position}`) || [];
        markers.forEach((racer) => {
          const marker = document.createElement("span");
          marker.className = `hot-streak-racer is-${racer.pattern || "plain"}`;
          if (racer.fallen) marker.classList.add("fallen");
          if (racer.facing === "backward") marker.classList.add("backward");
          marker.textContent = racer.icon;
          marker.title = `${racer.name}${racer.fallen ? " · fallen" : ""}${racer.facing === "backward" ? " · facing backward" : ""}`;
          marker.setAttribute("aria-label", marker.title);
          cell.appendChild(marker);
        });
        hotStreakTrack.appendChild(cell);
      }
    }
  }

  function hotStreakRenderCurrentCard(view) {
    if (!hotStreakCurrentCard) return;
    hotStreakCurrentCard.innerHTML = "";
    if (view.phase === "race_countdown") {
      const countdown = document.createElement("strong");
      countdown.className = "hot-streak-countdown";
      countdown.textContent = view.countdown > 0 ? String(view.countdown) : "GO!";
      hotStreakCurrentCard.appendChild(countdown);
      return;
    }
    if (view.phase === "racing" && view.current_card) {
      const icon = document.createElement("span");
      icon.className = "hot-streak-current-card-icon";
      icon.textContent = view.current_card.target_icon;
      const copy = document.createElement("div");
      const eyebrow = document.createElement("span");
      eyebrow.className = "hot-streak-card-eyebrow";
      eyebrow.textContent = `Cycle ${view.race_cycle} · Card ${(view.revealed_cards || []).length}`;
      const title = document.createElement("strong");
      title.textContent = view.current_card.label;
      copy.append(eyebrow, title);
      hotStreakCurrentCard.append(icon, copy);
      return;
    }
    const message = {
      betting: "Draft tickets before building the race deck.",
      card_selection: "Players are secretly adding race cards.",
      race_result: "Race complete — review the payouts.",
      game_over: "All three races are complete.",
    }[view.phase] || "Waiting for the race…";
    hotStreakCurrentCard.textContent = message;
  }

  function hotStreakLogMessage(view, entry) {
    const racerName = (racerId) => {
      const racer = hotStreakFindRacer(view, racerId);
      return racer ? `${racer.icon} ${racer.name}` : racerId;
    };
    switch (entry.type) {
      case "race_ready":
        return `Race ${entry.race} deck is ready.`;
      case "card":
        return `🃏 ${entry.card ? entry.card.label : "Card revealed"}`;
      case "move":
      case "all_move":
        return `${racerName(entry.racer_id)} moves from ${Number(entry.from) + 1} to ${Number(entry.to) + 1}.`;
      case "fall":
        return `${racerName(entry.racer_id)} falls down 💫.`;
      case "recover":
        return `${racerName(entry.racer_id)} recovers and faces forward.`;
      case "turn":
        return `${racerName(entry.racer_id)} turns ${entry.facing === "backward" ? "backward" : "forward"}.`;
      case "swerve":
        return `${racerName(entry.racer_id)} swerves to lane ${Number(entry.to_lane) + 1}.`;
      case "knockdown":
        return `${racerName(entry.mover_id)} knocks ${racerName(entry.racer_id)} down 💥.`;
      case "dq":
        return `${racerName(entry.racer_id)} is disqualified: ${String(entry.reason || "dq").replaceAll("_", " ")} 🚫.`;
      case "finish":
        return `${racerName(entry.racer_id)} claims place ${entry.rank}.`;
      case "fold":
        return `The rear edge folds to space ${Number(entry.cutoff) + 1}.`;
      case "side_bet_hit":
        return "The side bet locks to YES ✓.";
      case "no_effect":
        return `${racerName(entry.racer_id)} is already out; no effect.`;
      default:
        return null;
    }
  }

  function hotStreakRenderLog(view) {
    if (!hotStreakLog) return;
    hotStreakLog.innerHTML = "";
    const messages = (view.race_log || [])
      .map((entry) => hotStreakLogMessage(view, entry))
      .filter(Boolean)
      .slice(-60);
    if (!messages.length) {
      hotStreakLog.textContent = "The race log will appear here.";
      hotStreakLog.classList.add("hint");
      return;
    }
    hotStreakLog.classList.remove("hint");
    messages.forEach((message) => {
      const line = document.createElement("div");
      line.className = "hot-streak-log-line";
      line.textContent = message;
      hotStreakLog.appendChild(line);
    });
    hotStreakLog.scrollTop = hotStreakLog.scrollHeight;
  }

  function hotStreakRenderResults(view) {
    if (!hotStreakResult) return;
    const visible = view.phase === "race_result" || view.phase === "game_over";
    hotStreakResult.classList.toggle("hidden", !visible);
    hotStreakResult.innerHTML = "";
    if (!visible || !view.last_race_summary) return;
    const summary = view.last_race_summary;
    const title = document.createElement("h3");
    title.textContent = view.game_over ? "Final Results" : `Race ${summary.race_number} Results`;
    hotStreakResult.appendChild(title);

    const podium = document.createElement("div");
    podium.className = "hot-streak-podium";
    Object.values(summary.racers || {})
      .sort((left, right) => Number(left.payout_rank || 9) - Number(right.payout_rank || 9))
      .forEach((result) => {
        const racer = hotStreakFindRacer(view, result.racer_id) || {};
        const row = document.createElement("div");
        row.className = "hot-streak-result-row";
        const rank = result.rank_start === result.rank_end
          ? `#${result.rank_start}`
          : `#${result.rank_start}–${result.rank_end}`;
        row.textContent = `${rank} ${racer.icon || "🏃"} ${racer.name || result.racer_id}${result.status === "dq" ? ` · 🚫 ${String(result.dq_reason).replaceAll("_", " ")}` : ""}`;
        podium.appendChild(row);
      });
    hotStreakResult.appendChild(podium);

    const side = document.createElement("div");
    side.className = "hot-streak-result-side";
    side.textContent = `Side Bet: ${summary.side_bet_result && summary.side_bet_result.result ? "YES ✓" : "NO ✕"}`;
    hotStreakResult.appendChild(side);

    const payouts = document.createElement("div");
    payouts.className = "hot-streak-payouts";
    (view.players || []).forEach((player) => {
      const result = (summary.payouts || {})[player.player_id];
      if (!result) return;
      const row = document.createElement("div");
      row.className = "hot-streak-payout-player";
      const head = document.createElement("strong");
      head.textContent = `${player.name}: ${hotStreakMoney(result.money_before)} ${result.net >= 0 ? "+" : "−"} ${hotStreakMoney(Math.abs(result.net))} → ${hotStreakMoney(result.money_after)}`;
      row.appendChild(head);
      (result.tickets || []).forEach((ticket) => {
        const line = document.createElement("span");
        line.textContent = `${hotStreakTargetLabel(view, ticket.bet.target)} · ${ticket.hit ? "Hit" : "Miss"} · ${hotStreakMoney(ticket.delta)}${ticket.multiplier === 2 ? " ×2" : ""}`;
        row.appendChild(line);
      });
      payouts.appendChild(row);
    });
    hotStreakResult.appendChild(payouts);

    if (view.game_over) {
      const winners = document.createElement("div");
      winners.className = "hot-streak-winners";
      const names = (view.winner_ids || []).map((playerId) => hotStreakPlayerName(view, playerId));
      winners.textContent = `${names.length > 1 ? "Joint Winners" : "Winner"}: ${names.join(" & ")} 🏆`;
      hotStreakResult.appendChild(winners);
    } else {
      const progress = view.next_round_progress || {};
      const ready = document.createElement("div");
      ready.className = "hot-streak-ready-progress";
      ready.textContent = `Ready ${progress.done || 0}/${progress.total || 0}`;
      hotStreakResult.appendChild(ready);
    }
  }

  function hotStreakUpdateActions(view) {
    const racing = view.phase === "race_countdown" || view.phase === "racing";
    if (hotStreakContinueBtn) {
      hotStreakContinueBtn.disabled = !hotStreakHasAction("advance_race");
      if (!racing) hotStreakContinueBtn.classList.add("hidden");
    }
    if (hotStreakNextRaceBtn) {
      hotStreakNextRaceBtn.classList.toggle("hidden", view.phase !== "race_result");
      const me = hotStreakFindPlayer(view, view.you);
      hotStreakNextRaceBtn.disabled = !hotStreakHasAction("next_round");
      hotStreakNextRaceBtn.textContent = me && me.ready ? "Ready ✓" : "Next Race";
    }
    if (hotStreakPlayAgainBtn) {
      hotStreakPlayAgainBtn.classList.toggle("hidden", view.phase !== "game_over");
      hotStreakPlayAgainBtn.disabled = !hotStreakHasAction("play_again");
    }
  }

  function hotStreakScheduleAdvance(view) {
    if (hotStreakAdvanceTimer) window.clearTimeout(hotStreakAdvanceTimer);
    if (hotStreakFallbackTimer) window.clearTimeout(hotStreakFallbackTimer);
    hotStreakAdvanceTimer = null;
    hotStreakFallbackTimer = null;
    hotStreakScheduledStep = null;
    if (!hotStreakHasAction("advance_race")) return;
    const step = Number(view.step_index || 0);
    const key = `${view.game_index}:${view.race_number}:${step}`;
    hotStreakScheduledStep = key;
    const players = Array.isArray(view.players) ? view.players : [];
    const botWillDrive = players.some((player) => player.is_bot);
    const humanDriver = players.find((player) => !player.is_bot);
    const shouldAutoDrive = !botWillDrive && humanDriver && humanDriver.player_id === view.you;
    if (shouldAutoDrive) {
      const delay = view.phase === "race_countdown" ? 650 : 950;
      hotStreakAdvanceTimer = window.setTimeout(() => {
        if (!hotStreakView || hotStreakScheduledStep !== key) return;
        sendAction({type: "advance_race", expected_step_index: step});
      }, delay);
    }
    hotStreakFallbackTimer = window.setTimeout(() => {
      if (hotStreakContinueBtn && hotStreakScheduledStep === key) {
        hotStreakContinueBtn.classList.remove("hidden");
      }
    }, 3000);
  }

  function hotStreakSetExplainMode(enabled) {
    hotStreakExplainMode = Boolean(enabled);
    if (hotStreakPanel) hotStreakPanel.classList.toggle("hot-streak-explaining", hotStreakExplainMode);
    if (hotStreakExplainBtn) {
      hotStreakExplainBtn.setAttribute("aria-pressed", hotStreakExplainMode ? "true" : "false");
      hotStreakExplainBtn.textContent = hotStreakExplainMode ? "Exit Explain" : "Explain";
    }
  }

  function hotStreakShowExplanation(key) {
    const explanation = HOT_STREAK_EXPLANATIONS[key];
    if (!explanation || !hotStreakExplainContent) return;
    hotStreakExplainContent.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = explanation.name;
    const body = document.createElement("p");
    body.textContent = explanation.description;
    hotStreakExplainContent.append(title, body);
    hotStreakSetModal(hotStreakExplainModal, true);
  }

  function hotStreakFindExplainTargetAtPoint(x, y) {
    const targets = document.querySelectorAll("[data-hot-streak-explain]");
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return target;
      }
    }
    return null;
  }

  function hotStreakRenderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    hotStreakView = view;
    if (typeof currentGameType !== "undefined" && currentGameType !== "hot_streak") {
      currentGameType = "hot_streak";
      setGamePanelVisibility("hot_streak");
    }
    if (hotStreakRaceLabel) hotStreakRaceLabel.textContent = `Race ${view.race_number} of ${view.race_total || 3}`;
    if (hotStreakPhaseLabel) hotStreakPhaseLabel.textContent = HOT_STREAK_PHASE_LABELS[view.phase] || view.phase || "-";
    if (hotStreakDataNotice) {
      hotStreakDataNotice.classList.toggle("hidden", view.catalog_status !== "prototype");
    }
    if (hotStreakTurnLabel) {
      hotStreakTurnLabel.textContent = view.phase === "betting"
        ? `${hotStreakPlayerName(view, view.current_drafter)}'s pick`
        : view.phase === "card_selection"
          ? `${(view.submission_progress || {}).done || 0}/${(view.submission_progress || {}).total || 0} submitted`
          : view.phase === "racing"
            ? `Step ${view.step_index}`
            : "-";
    }
    hotStreakRenderPlayers(view);
    hotStreakRenderSideBet(view);
    hotStreakRenderPool(view);
    hotStreakRenderTickets(view);
    hotStreakRenderHand(view);
    hotStreakRenderTrack(view);
    hotStreakRenderCurrentCard(view);
    hotStreakRenderLog(view);
    hotStreakRenderResults(view);
    hotStreakUpdateActions(view);
    if (hotStreakPoolSection) {
      hotStreakPoolSection.classList.toggle(
        "hidden",
        view.phase !== "betting" && view.phase !== "card_selection"
      );
    }
    if (hotStreakTicketSection) hotStreakTicketSection.classList.toggle("hidden", view.phase !== "betting");
    if (hotStreakHandSection) hotStreakHandSection.classList.toggle("hidden", view.phase !== "card_selection");
    hotStreakScheduleAdvance(view);
  }

  function hotStreakClearState() {
    hotStreakView = null;
    hotStreakSelectedCards.clear();
    hotStreakPendingStack = null;
    hotStreakPendingDouble = null;
    hotStreakScheduledStep = null;
    if (hotStreakAdvanceTimer) window.clearTimeout(hotStreakAdvanceTimer);
    if (hotStreakFallbackTimer) window.clearTimeout(hotStreakFallbackTimer);
    hotStreakAdvanceTimer = null;
    hotStreakFallbackTimer = null;
    [hotStreakPlayers, hotStreakTrack, hotStreakPool, hotStreakTickets, hotStreakHand, hotStreakLog, hotStreakResult].forEach((element) => {
      if (element) element.innerHTML = "";
    });
    if (hotStreakCurrentCard) hotStreakCurrentCard.textContent = "Waiting for the race…";
    hotStreakSetExplainMode(false);
    hotStreakSetModal(hotStreakBetModal, false);
    hotStreakSetModal(hotStreakHelpModal, false);
    hotStreakSetModal(hotStreakExplainModal, false);
  }

  function hotStreakShowHeaderActions(show) {
    if (hotStreakHeaderActions) hotStreakHeaderActions.style.display = show ? "flex" : "none";
    if (!show) hotStreakSetExplainMode(false);
  }

  if (hotStreakHelpContent) hotStreakHelpContent.innerHTML = HOT_STREAK_HELP_HTML;

  if (hotStreakSubmitBtn) {
    hotStreakSubmitBtn.addEventListener("click", () => {
      if (!hotStreakHasAction("submit_race_cards")) return;
      sendAction({type: "submit_race_cards", card_ids: Array.from(hotStreakSelectedCards)});
    });
  }
  if (hotStreakContinueBtn) {
    hotStreakContinueBtn.addEventListener("click", () => {
      if (!hotStreakView || !hotStreakHasAction("advance_race")) return;
      sendAction({type: "advance_race", expected_step_index: Number(hotStreakView.step_index || 0)});
    });
  }
  if (hotStreakNextRaceBtn) {
    hotStreakNextRaceBtn.addEventListener("click", () => sendAction({type: "next_round"}));
  }
  if (hotStreakPlayAgainBtn) {
    hotStreakPlayAgainBtn.addEventListener("click", () => sendAction({type: "play_again"}));
  }
  if (hotStreakHandSection) {
    hotStreakHandSection.addEventListener("click", (event) => {
      if (hotStreakExplainMode) return;
      if (event.target === hotStreakHandSection || event.target === hotStreakHand || event.target === hotStreakHandHint) {
        hotStreakSelectedCards.clear();
        if (hotStreakView) hotStreakRenderHand(hotStreakView);
      }
    });
  }
  if (hotStreakHelpBtn) {
    hotStreakHelpBtn.addEventListener("click", () => hotStreakSetModal(hotStreakHelpModal, true));
  }
  if (hotStreakExplainBtn) {
    hotStreakExplainBtn.addEventListener("click", () => hotStreakSetExplainMode(!hotStreakExplainMode));
  }
  if (hotStreakBetModalCloseBtn) {
    hotStreakBetModalCloseBtn.addEventListener("click", () => hotStreakSetModal(hotStreakBetModal, false));
  }
  if (hotStreakHelpModalCloseBtn) {
    hotStreakHelpModalCloseBtn.addEventListener("click", () => hotStreakSetModal(hotStreakHelpModal, false, hotStreakHelpBtn));
  }
  if (hotStreakExplainModalCloseBtn) {
    hotStreakExplainModalCloseBtn.addEventListener("click", () => hotStreakSetModal(hotStreakExplainModal, false));
  }
  [hotStreakBetModal, hotStreakHelpModal, hotStreakExplainModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) hotStreakSetModal(modal, false);
    });
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!hotStreakExplainMode || typeof currentGameType === "undefined" || currentGameType !== "hot_streak") return;
      const allowed = [hotStreakExplainBtn, hotStreakHelpBtn, hotStreakHelpModalCloseBtn, hotStreakExplainModalCloseBtn];
      if (allowed.some((element) => element && (event.target === element || element.contains(event.target)))) return;
      const target = hotStreakFindExplainTargetAtPoint(event.clientX, event.clientY);
      if (target) {
        event.preventDefault();
        event.stopPropagation();
        hotStreakSuppressClick = true;
        hotStreakShowExplanation(target.dataset.hotStreakExplain);
        hotStreakSetExplainMode(false);
        return;
      }
      if (hotStreakPanel && hotStreakPanel.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        hotStreakSuppressClick = true;
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!hotStreakSuppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      hotStreakSuppressClick = false;
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (hotStreakExplainMode) hotStreakSetExplainMode(false);
    if (hotStreakBetModal && !hotStreakBetModal.classList.contains("hidden")) hotStreakSetModal(hotStreakBetModal, false);
    if (hotStreakHelpModal && !hotStreakHelpModal.classList.contains("hidden")) hotStreakSetModal(hotStreakHelpModal, false, hotStreakHelpBtn);
    if (hotStreakExplainModal && !hotStreakExplainModal.classList.contains("hidden")) hotStreakSetModal(hotStreakExplainModal, false);
  });

  window.clearHotStreakState = hotStreakClearState;
  window.renderHotStreakGameState = hotStreakRenderGameState;
  window.showHotStreakHeaderActions = hotStreakShowHeaderActions;
})();
