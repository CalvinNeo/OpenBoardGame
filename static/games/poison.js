(() => {
  "use strict";

  let poisonView = null;
  let poisonSelectedCardId = null;
  let poisonPendingAction = false;
  let poisonPendingTimer = null;
  let poisonExplainMode = false;

  const poisonPanel = document.getElementById("poisonPanel");
  const poisonHeaderActions = document.getElementById("poisonHeaderActions");
  const poisonHelpBtn = document.getElementById("poisonHelpBtn");
  const poisonExplainBtn = document.getElementById("poisonExplainBtn");
  const poisonHelpModal = document.getElementById("poisonHelpModal");
  const poisonHelpCloseBtn = document.getElementById("poisonHelpCloseBtn");
  const poisonHelpContent = document.getElementById("poisonHelpContent");
  const poisonExplainModal = document.getElementById("poisonExplainModal");
  const poisonExplainCloseBtn = document.getElementById("poisonExplainCloseBtn");
  const poisonExplainContent = document.getElementById("poisonExplainContent");
  const poisonRoundLabel = document.getElementById("poisonRoundLabel");
  const poisonTotalRoundsLabel = document.getElementById("poisonTotalRoundsLabel");
  const poisonDealerLabel = document.getElementById("poisonDealerLabel");
  const poisonTurnLabel = document.getElementById("poisonTurnLabel");
  const poisonStatus = document.getElementById("poisonStatus");
  const poisonPlayers = document.getElementById("poisonPlayers");
  const poisonCauldrons = document.getElementById("poisonCauldrons");
  const poisonHand = document.getElementById("poisonHand");
  const poisonHandCount = document.getElementById("poisonHandCount");
  const poisonSummary = document.getElementById("poisonSummary");
  const poisonSummaryTitle = document.getElementById("poisonSummaryTitle");
  const poisonSummaryStatus = document.getElementById("poisonSummaryStatus");
  const poisonSummaryPlayers = document.getElementById("poisonSummaryPlayers");
  const poisonNextRoundBtn = document.getElementById("poisonNextRoundBtn");
  const poisonPlayAgainBtn = document.getElementById("poisonPlayAgainBtn");
  const poisonLog = document.getElementById("poisonLog");

  const POISON_CARD_META = {
    red: { emoji: "🔴", label: "Red potion", short: "R" },
    blue: { emoji: "🔵", label: "Blue potion", short: "B" },
    purple: { emoji: "🟣", label: "Purple potion", short: "P" },
    poison: { emoji: "☠️", label: "Poison", short: "POISON" },
  };

  const POISON_EXPLANATIONS = {
    hand: {
      title: "Potion Card",
      body: "Select one card from your hand. A colored potion must go to its matching cauldron, or to an unassigned cauldron if that color is not yet on the table. Poison can go anywhere.",
    },
    cauldron: {
      title: "Cauldron",
      body: "Play the selected card here. A total of 13 is safe. Above 13, you take every card that was already here face down; the card you just played stays behind.",
    },
    next: {
      title: "Next Round",
      body: "Confirm that you have reviewed the scores. The next round starts only after every player is ready; bots confirm automatically.",
    },
    again: {
      title: "Play Again",
      body: "Confirm a rematch with the same players. A fresh game begins only after everyone is ready.",
    },
  };

  const POISON_HELP_HTML = `
    <div class="poison-rules">
      <p><strong>Goal.</strong> Finish the game with the fewest penalty points. The game lasts one round per player.</p>
      <p><strong>Deck.</strong> Red, blue, and purple each have 14 potion cards: three 1s, three 2s, two 4s, three 5s, and three 7s. Eight poison cards are all value 4, for 50 cards total.</p>
      <p><strong>Your turn.</strong> Choose one card, then choose a legal cauldron. Colored potions of the same color always share one cauldron. A poison card ☠️ may be played into any cauldron.</p>
      <p><strong>Unassigned cauldrons.</strong> An empty cauldron, or one containing only poison, has no color. The first colored potion in it assigns that color. Color is derived from the cards currently in the cauldron.</p>
      <p><strong>Limit 13.</strong> Add the printed values. A total of exactly 13 is safe. If the new total is above 13, take all cards that were already in the cauldron face down. The triggering card remains as the new first card.</p>
      <p><strong>Hidden captures.</strong> During the round, everyone sees only how many cards each player has taken. Captured card identities are revealed only in the round summary.</p>
      <p><strong>Scoring.</strong> Each captured colored potion is 1 penalty point and each poison card is 2. For each potion color, its unique majority holder ignores all points of that color. A tied majority gives no immunity. Poison can never be ignored.</p>
      <p><strong>Round review.</strong> Cards left in cauldrons do not score. Everyone must choose Next Round before the next deal. The lowest total penalty wins; ties share the win.</p>
      <h3>Digital Notes</h3>
      <p>The first dealer is selected by the server, then moves clockwise. The player to the dealer's left starts. Players with empty hands are skipped automatically.</p>
      <p>In a three-player game, a hidden fourth hand is removed for the round and never revealed. Uneven deals are intentional. Bots confirm round reviews automatically, while human players confirm for themselves.</p>
      <p><strong>Card keys:</strong> 🔴 R red · 🔵 B blue · 🟣 P purple · ☠️ POISON green.</p>
    </div>
  `;

  function poisonSetModal(modal, visible, returnFocus) {
    if (!modal) return;
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      const focusable = modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable) window.setTimeout(() => focusable.focus(), 0);
    } else if (returnFocus) {
      returnFocus.focus();
    }
  }

  function poisonFindPlayer(view, playerId) {
    return (view.players || []).find((player) => player.player_id === playerId) || null;
  }

  function poisonPlayerName(view, playerId) {
    const player = poisonFindPlayer(view, playerId);
    return (player && (player.name || player.player_id)) || playerId || "-";
  }

  function poisonHasAction(actionType) {
    return Boolean(
      poisonView &&
        Array.isArray(poisonView.legal_actions) &&
        poisonView.legal_actions.includes(actionType)
    );
  }

  function poisonLegalPlay(cardId) {
    if (!poisonView || !Array.isArray(poisonView.legal_plays)) return null;
    return poisonView.legal_plays.find((play) => play.card_id === cardId) || null;
  }

  function poisonSelectedCard() {
    if (!poisonView || !poisonSelectedCardId) return null;
    return (poisonView.your_hand || []).find((card) => card.id === poisonSelectedCardId) || null;
  }

  function poisonDispatch(action) {
    if (poisonPendingAction || typeof sendAction !== "function") return;
    poisonPendingAction = true;
    if (poisonPendingTimer) window.clearTimeout(poisonPendingTimer);
    poisonPendingTimer = window.setTimeout(() => {
      poisonPendingAction = false;
      poisonPendingTimer = null;
      if (poisonView) poisonRenderInteractive(poisonView);
    }, 1500);
    sendAction(action);
    if (poisonView) poisonRenderInteractive(poisonView);
  }

  function poisonCardFace(card, compact = false) {
    const meta = POISON_CARD_META[card.color] || POISON_CARD_META.poison;
    const face = document.createElement("span");
    face.className = `poison-card-face poison-card-${card.color}${compact ? " is-compact" : ""}`;

    const marker = document.createElement("span");
    marker.className = "poison-card-marker";
    marker.textContent = meta.emoji;
    marker.setAttribute("aria-hidden", "true");

    const value = document.createElement("strong");
    value.className = "poison-card-value";
    value.textContent = String(card.value);

    const key = document.createElement("span");
    key.className = "poison-card-key";
    key.textContent = meta.short;

    const penalty = document.createElement("span");
    penalty.className = "poison-card-penalty";
    penalty.textContent = card.kind === "poison" ? "2 pts" : "1 pt";

    face.append(marker, value, penalty, key);
    return face;
  }

  function poisonCardLabel(card) {
    const meta = POISON_CARD_META[card.color] || POISON_CARD_META.poison;
    return `${meta.label} ${card.value}`;
  }

  function poisonSetExplainMode(enabled) {
    poisonExplainMode = Boolean(enabled);
    document.body.classList.toggle("poison-explain-mode", poisonExplainMode);
    if (poisonExplainBtn) poisonExplainBtn.setAttribute("aria-pressed", poisonExplainMode ? "true" : "false");
    document.querySelectorAll("[data-poison-explanation]").forEach((element) => {
      element.classList.toggle("has-explanation", poisonExplainMode);
    });
  }

  function poisonRefreshExplainTargets() {
    if (!poisonExplainMode) return;
    document.querySelectorAll("[data-poison-explanation]").forEach((element) => {
      element.classList.add("has-explanation");
    });
  }

  function poisonShowExplanation(key) {
    const explanation = POISON_EXPLANATIONS[key];
    if (!explanation || !poisonExplainContent) return;
    poisonExplainContent.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = explanation.title;
    const body = document.createElement("p");
    body.textContent = explanation.body;
    poisonExplainContent.append(title, body);
    poisonSetModal(poisonExplainModal, true);
  }

  function poisonFindDisabledExplainTargetAtPoint(x, y) {
    const targets = document.querySelectorAll("button[data-poison-explanation]:disabled");
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return target;
      }
    }
    return null;
  }

  function poisonRenderPlayers(view) {
    if (!poisonPlayers) return;
    poisonPlayers.innerHTML = "";
    (view.players || []).forEach((player) => {
      const card = document.createElement("article");
      card.className = "poison-player";
      if (player.player_id === view.you) card.classList.add("is-self");
      if (player.player_id === view.current_turn) card.classList.add("is-current");

      const heading = document.createElement("div");
      heading.className = "poison-player-heading";
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      const badges = document.createElement("span");
      badges.className = "poison-player-badges";
      if (player.player_id === view.dealer_id) badges.appendChild(poisonTextBadge("Dealer"));
      if (player.player_id === view.current_turn) {
        badges.appendChild(poisonTextBadge(player.player_id === view.you ? "Your turn" : "Turn"));
      }
      if (player.is_bot) badges.appendChild(poisonTextBadge("Bot"));
      if (player.player_id === view.you) badges.appendChild(poisonTextBadge("You"));
      heading.append(name, badges);

      const stats = document.createElement("div");
      stats.className = "poison-player-stats";
      const hand = document.createElement("span");
      hand.textContent = `🃏 ${Number(player.hand_count || 0)}`;
      hand.title = "Cards in hand";
      const captured = document.createElement("span");
      captured.textContent = `🂠 ${Number(player.captured_count || 0)}`;
      captured.title = "Captured face-down cards";
      const score = document.createElement("span");
      score.textContent = `⚠️ ${Number(player.total_score || 0)}`;
      score.title = "Total penalty";
      stats.append(hand, captured, score);

      const state = document.createElement("div");
      state.className = "poison-player-state";
      if (view.phase === "round_summary") {
        state.textContent = player.next_round_ready ? "Ready ✓" : "Reviewing…";
      } else if (view.phase === "game_over") {
        state.textContent = player.rematch_ready ? "Rematch ready ✓" : "Final result";
      } else if (player.player_id === view.current_turn) {
        state.textContent = "Choosing a card…";
      } else if (!Number(player.hand_count || 0)) {
        state.textContent = "Hand empty";
      } else {
        state.textContent = "Waiting";
      }

      card.append(heading, stats, state);
      poisonPlayers.appendChild(card);
    });
  }

  function poisonTextBadge(text) {
    const badge = document.createElement("span");
    badge.className = "poison-player-badge";
    badge.textContent = text;
    return badge;
  }

  function poisonRenderHand(view) {
    if (!poisonHand) return;
    poisonHand.innerHTML = "";
    const cards = Array.isArray(view.your_hand) ? view.your_hand : [];
    if (poisonHandCount) poisonHandCount.textContent = `${cards.length} ${cards.length === 1 ? "card" : "cards"}`;
    if (!cards.length) {
      const empty = document.createElement("div");
      empty.className = "poison-empty-state";
      empty.textContent = view.phase === "playing" ? "Your hand is empty. Turns skip you automatically." : "No cards in hand.";
      poisonHand.appendChild(empty);
      return;
    }

    const canPlay = poisonHasAction("play_card") && view.current_turn === view.you;
    cards.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "poison-hand-card";
      button.dataset.poisonExplanation = "hand";
      button.disabled = !canPlay || poisonPendingAction;
      const penaltyLabel = card.kind === "poison" ? "2 penalty points if captured" : "1 penalty point if captured";
      button.setAttribute(
        "aria-label",
        `${poisonCardLabel(card)}, ${penaltyLabel}${card.id === poisonSelectedCardId ? ", selected" : ""}`
      );
      button.setAttribute("aria-pressed", card.id === poisonSelectedCardId ? "true" : "false");
      if (card.id === poisonSelectedCardId) button.classList.add("is-selected");
      button.appendChild(poisonCardFace(card));
      button.addEventListener("click", () => {
        if (poisonExplainMode || button.disabled) return;
        poisonSelectedCardId = poisonSelectedCardId === card.id ? null : card.id;
        poisonRenderInteractive(view);
      });
      poisonHand.appendChild(button);
    });
  }

  function poisonRenderCauldrons(view) {
    if (!poisonCauldrons) return;
    poisonCauldrons.innerHTML = "";
    const selectedCard = poisonSelectedCard();
    const legalPlay = selectedCard ? poisonLegalPlay(selectedCard.id) : null;
    const legalIndices = new Set(legalPlay ? legalPlay.cauldron_indices || [] : []);

    (view.cauldrons || []).forEach((cauldron) => {
      const index = Number(cauldron.index);
      const isLegal = Boolean(selectedCard && legalIndices.has(index) && poisonHasAction("play_card"));
      const outcome = legalPlay && legalPlay.outcomes ? legalPlay.outcomes[String(index)] : null;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `poison-cauldron poison-cauldron-${cauldron.derived_color || "unassigned"}`;
      button.dataset.poisonExplanation = "cauldron";
      button.disabled = !isLegal || poisonPendingAction;
      if (isLegal) button.classList.add("is-legal");
      if (outcome && outcome.will_overflow) button.classList.add("will-overflow");
      if (Number(cauldron.total || 0) === Number(view.cauldron_limit || 13)) button.classList.add("at-limit");

      const heading = document.createElement("span");
      heading.className = "poison-cauldron-heading";
      const label = document.createElement("strong");
      label.textContent = `⚗️ ${index + 1}`;
      const total = document.createElement("span");
      total.className = "poison-cauldron-total";
      total.textContent = `${Number(cauldron.total || 0)}/13`;
      heading.append(label, total);

      const color = document.createElement("span");
      color.className = "poison-cauldron-color";
      const colorMeta = cauldron.derived_color ? POISON_CARD_META[cauldron.derived_color] : null;
      color.textContent = colorMeta ? `${colorMeta.emoji} ${colorMeta.label}` : "⚪ Unassigned";

      const cards = document.createElement("span");
      cards.className = "poison-cauldron-cards";
      (cauldron.cards || []).forEach((card) => cards.appendChild(poisonCardFace(card, true)));
      if (!(cauldron.cards || []).length) {
        const empty = document.createElement("span");
        empty.className = "poison-cauldron-empty";
        empty.textContent = "Empty";
        cards.appendChild(empty);
      }

      const preview = document.createElement("span");
      preview.className = "poison-cauldron-preview";
      if (!selectedCard) {
        preview.textContent = "Select a card first";
      } else if (!legalIndices.has(index)) {
        preview.textContent = "Different potion color";
      } else if (outcome && outcome.will_overflow) {
        preview.textContent = `Overflow ${outcome.new_total} · take ${outcome.captured_count}`;
      } else if (outcome) {
        preview.textContent = Number(outcome.new_total) === Number(view.cauldron_limit || 13)
          ? `${outcome.new_total}/13 · At limit`
          : `${outcome.new_total}/13 · Safe`;
      } else {
        preview.textContent = "Unavailable";
      }

      button.setAttribute(
        "aria-label",
        `Cauldron ${index + 1}, ${cauldron.derived_color || "unassigned"}, total ${cauldron.total || 0}, ${(cauldron.cards || []).length} cards. ${preview.textContent}`
      );
      button.append(heading, color, cards, preview);
      button.addEventListener("click", () => {
        if (poisonExplainMode || button.disabled || !selectedCard) return;
        const cardId = selectedCard.id;
        poisonSelectedCardId = null;
        poisonDispatch({ type: "play_card", card_id: cardId, cauldron_index: index });
      });
      poisonCauldrons.appendChild(button);
    });
  }

  function poisonBreakdownChip(color, breakdown) {
    const meta = POISON_CARD_META[color];
    const chip = document.createElement("span");
    chip.className = `poison-score-chip poison-score-${color}${breakdown.immune ? " is-immune" : ""}`;
    const points = Number(breakdown.points || 0);
    chip.textContent = `${meta.emoji} ${Number(breakdown.count || 0)} → ${points}${breakdown.immune ? " 🛡️" : ""}`;
    chip.title = `${meta.label}: ${breakdown.count || 0} cards, ${points} points${breakdown.immune ? ", majority immunity" : ""}`;
    return chip;
  }

  function poisonRenderSummary(view) {
    if (!poisonSummary || !poisonSummaryPlayers) return;
    const visible = view.phase === "round_summary" || view.phase === "game_over";
    poisonSummary.classList.toggle("hidden", !visible);
    if (!visible) {
      poisonSummaryPlayers.innerHTML = "";
      return;
    }

    const summary = view.round_summary || {};
    const isGameOver = view.phase === "game_over";
    const winners = (view.winner_ids || []).map((playerId) => poisonPlayerName(view, playerId));
    if (poisonSummaryTitle) {
      const winnerText = winners.length === 1 ? `${winners[0]} wins` : `${winners.join(" & ")} win`;
      poisonSummaryTitle.textContent = isGameOver
        ? `Final Result · ${winners.length ? winnerText : "Game Over"}`
        : `Round ${summary.round_number || view.round_number} Summary`;
    }

    const readyIds = isGameOver ? view.rematch_ready || [] : view.next_round_ready || [];
    if (poisonSummaryStatus) {
      const unscored = Number(summary.unscored_cauldron_count || 0);
      const waitingNames = (view.players || [])
        .filter((player) => !readyIds.includes(player.player_id))
        .map((player) => player.name || player.player_id);
      poisonSummaryStatus.textContent = `${unscored} cauldron cards not scored · Ready ${readyIds.length}/${(view.players || []).length}${waitingNames.length ? ` · Waiting: ${waitingNames.join(", ")}` : ""}`;
    }

    poisonSummaryPlayers.innerHTML = "";
    (view.players || []).forEach((player) => {
      const result = (summary.players && summary.players[player.player_id]) || {};
      const breakdown = result.breakdown || player.round_breakdown || {};
      const row = document.createElement("article");
      row.className = "poison-summary-player";
      if ((view.winner_ids || []).includes(player.player_id)) row.classList.add("is-winner");

      const heading = document.createElement("div");
      heading.className = "poison-summary-player-heading";
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      const totals = document.createElement("span");
      totals.textContent = `Round +${Number(result.round_score ?? player.round_score ?? 0)} · Total ${Number(result.total_score ?? player.total_score ?? 0)}`;
      heading.append(name, totals);

      const chips = document.createElement("div");
      chips.className = "poison-score-chips";
      ["red", "blue", "purple", "poison"].forEach((color) => {
        chips.appendChild(poisonBreakdownChip(color, breakdown[color] || { count: 0, points: 0, immune: false }));
      });
      row.append(heading, chips);
      poisonSummaryPlayers.appendChild(row);
    });

    if (poisonNextRoundBtn) {
      poisonNextRoundBtn.classList.toggle("hidden", isGameOver);
      poisonNextRoundBtn.disabled = isGameOver || !poisonHasAction("next_round") || poisonPendingAction;
      poisonNextRoundBtn.textContent = (view.next_round_ready || []).includes(view.you) ? "Ready ✓" : "Next Round";
    }
    if (poisonPlayAgainBtn) {
      poisonPlayAgainBtn.classList.toggle("hidden", !isGameOver);
      poisonPlayAgainBtn.disabled = !isGameOver || !poisonHasAction("play_again") || poisonPendingAction;
      poisonPlayAgainBtn.textContent = (view.rematch_ready || []).includes(view.you) ? "Ready ✓" : "Play Again";
    }
  }

  function poisonRenderStatus(view) {
    if (!poisonStatus) return;
    if (view.phase === "game_over") {
      const winners = (view.winner_ids || []).map((playerId) => poisonPlayerName(view, playerId));
      const verb = winners.length === 1 ? "wins" : "win";
      poisonStatus.textContent = winners.length ? `🏆 ${winners.join(" & ")} ${verb} with the lowest penalty.` : "Game over.";
      return;
    }
    if (view.phase === "round_summary") {
      poisonStatus.textContent = "Round scored. Review the revealed counts, then confirm when ready.";
      return;
    }
    if (view.current_turn === view.you) {
      if (poisonSelectedCardId) {
        poisonStatus.textContent = "Choose one highlighted cauldron. Tap open space to cancel your card selection.";
      } else {
        poisonStatus.textContent = "Your turn — choose a card, then choose a cauldron.";
      }
      return;
    }
    poisonStatus.textContent = `Waiting for ${poisonPlayerName(view, view.current_turn)}.`;
  }

  function poisonRenderLog(view) {
    if (!poisonLog) return;
    if (view.phase === "round_summary" || view.phase === "game_over") {
      const unscored = Number((view.round_summary || {}).unscored_cauldron_count || 0);
      poisonLog.textContent = `Round ${view.round_number} ended. ${unscored} cards remained in cauldrons and were not scored.`;
      return;
    }
    const action = view.last_action;
    if (!action) {
      poisonLog.textContent = "No actions yet.";
      return;
    }
    const actor = poisonPlayerName(view, action.player_id);
    poisonLog.textContent = action.overflow
      ? `${actor} overflowed Cauldron ${Number(action.cauldron_index) + 1} and took ${Number(action.captured_count || 0)} cards face down.`
      : `${actor} played to Cauldron ${Number(action.cauldron_index) + 1}.`;
  }

  function poisonRenderInteractive(view) {
    poisonRenderHand(view);
    poisonRenderCauldrons(view);
    poisonRenderSummary(view);
    poisonRenderStatus(view);
    poisonRefreshExplainTargets();
  }

  function poisonRenderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    poisonView = view;
    poisonPendingAction = false;
    if (poisonPendingTimer) window.clearTimeout(poisonPendingTimer);
    poisonPendingTimer = null;

    const handIds = new Set((view.your_hand || []).map((card) => card.id));
    if (!handIds.has(poisonSelectedCardId) || !poisonLegalPlay(poisonSelectedCardId)) {
      poisonSelectedCardId = null;
    }

    if (typeof currentGameType !== "undefined" && currentGameType !== "poison") {
      currentGameType = "poison";
      setGamePanelVisibility("poison");
    }
    if (poisonRoundLabel) poisonRoundLabel.textContent = view.round_number ?? "-";
    if (poisonTotalRoundsLabel) poisonTotalRoundsLabel.textContent = view.total_rounds ?? "-";
    if (poisonDealerLabel) poisonDealerLabel.textContent = poisonPlayerName(view, view.dealer_id);
    if (poisonTurnLabel) poisonTurnLabel.textContent = view.current_turn ? poisonPlayerName(view, view.current_turn) : "Review";

    poisonRenderPlayers(view);
    poisonRenderInteractive(view);
    poisonRenderLog(view);
  }

  function poisonClearState() {
    poisonView = null;
    poisonSelectedCardId = null;
    poisonPendingAction = false;
    if (poisonPendingTimer) window.clearTimeout(poisonPendingTimer);
    poisonPendingTimer = null;
    poisonSetExplainMode(false);
    poisonSetModal(poisonHelpModal, false);
    poisonSetModal(poisonExplainModal, false);
    [poisonPlayers, poisonCauldrons, poisonHand, poisonSummaryPlayers].forEach((element) => {
      if (element) element.innerHTML = "";
    });
    if (poisonStatus) poisonStatus.textContent = "Waiting for game state…";
    if (poisonLog) poisonLog.textContent = "No actions yet.";
    if (poisonSummary) poisonSummary.classList.add("hidden");
  }

  function poisonShowHeaderActions(show) {
    if (poisonHeaderActions) poisonHeaderActions.style.display = show ? "flex" : "none";
    if (!show) {
      poisonSelectedCardId = null;
      poisonSetExplainMode(false);
      poisonSetModal(poisonHelpModal, false);
      poisonSetModal(poisonExplainModal, false);
    }
  }

  if (poisonHelpContent) poisonHelpContent.innerHTML = POISON_HELP_HTML;
  if (poisonNextRoundBtn) poisonNextRoundBtn.dataset.poisonExplanation = "next";
  if (poisonPlayAgainBtn) poisonPlayAgainBtn.dataset.poisonExplanation = "again";

  if (poisonNextRoundBtn) {
    poisonNextRoundBtn.addEventListener("click", () => {
      if (!poisonHasAction("next_round")) return;
      poisonDispatch({ type: "next_round" });
    });
  }
  if (poisonPlayAgainBtn) {
    poisonPlayAgainBtn.addEventListener("click", () => {
      if (!poisonHasAction("play_again")) return;
      poisonDispatch({ type: "play_again" });
    });
  }
  if (poisonHelpBtn) {
    poisonHelpBtn.addEventListener("click", () => poisonSetModal(poisonHelpModal, true));
  }
  if (poisonExplainBtn) {
    poisonExplainBtn.addEventListener("click", () => poisonSetExplainMode(!poisonExplainMode));
  }
  if (poisonHelpCloseBtn) {
    poisonHelpCloseBtn.addEventListener("click", () => poisonSetModal(poisonHelpModal, false, poisonHelpBtn));
  }
  if (poisonExplainCloseBtn) {
    poisonExplainCloseBtn.addEventListener("click", () => poisonSetModal(poisonExplainModal, false));
  }
  [poisonHelpModal, poisonExplainModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        poisonSetModal(modal, false, modal === poisonHelpModal ? poisonHelpBtn : null);
      }
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!poisonExplainMode || typeof currentGameType === "undefined" || currentGameType !== "poison") return;
      const button = event.target.closest("button");
      if (!button) return;
      const exceptions = [poisonHelpBtn, poisonExplainBtn, poisonHelpCloseBtn, poisonExplainCloseBtn];
      if (exceptions.includes(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const key = button.dataset.poisonExplanation;
      if (key) {
        poisonShowExplanation(key);
        poisonSetExplainMode(false);
      }
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!poisonExplainMode || typeof currentGameType === "undefined" || currentGameType !== "poison") return;
      const target = poisonFindDisabledExplainTargetAtPoint(event.clientX, event.clientY);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      poisonShowExplanation(target.dataset.poisonExplanation);
      poisonSetExplainMode(false);
    },
    true
  );

  document.addEventListener("pointerdown", (event) => {
    if (
      poisonExplainMode ||
      !poisonSelectedCardId ||
      typeof currentGameType === "undefined" ||
      currentGameType !== "poison" ||
      !poisonPanel ||
      !poisonPanel.contains(event.target)
    ) {
      return;
    }
    if (event.target.closest(".poison-hand-card, .poison-cauldron")) return;
    poisonSelectedCardId = null;
    if (poisonView) poisonRenderInteractive(poisonView);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (poisonExplainMode) poisonSetExplainMode(false);
    if (poisonSelectedCardId) {
      poisonSelectedCardId = null;
      if (poisonView) poisonRenderInteractive(poisonView);
    }
    if (poisonHelpModal && !poisonHelpModal.classList.contains("hidden")) {
      poisonSetModal(poisonHelpModal, false, poisonHelpBtn);
    }
    if (poisonExplainModal && !poisonExplainModal.classList.contains("hidden")) {
      poisonSetModal(poisonExplainModal, false);
    }
  });

  window.clearPoisonState = poisonClearState;
  window.renderPoisonGameState = poisonRenderGameState;
  window.showPoisonHeaderActions = poisonShowHeaderActions;
})();
