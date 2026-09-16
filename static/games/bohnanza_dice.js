(() => {
  "use strict";

  let bohnanzaDiceView = null;
  let bohnanzaDiceSelectedIds = new Set();
  let bohnanzaDicePending = false;
  let bohnanzaDicePendingTimer = null;
  let bohnanzaDiceExplainMode = false;
  let bohnanzaDiceLastAnnounced = 0;

  const bohnanzaDicePanel = document.getElementById("bohnanzaDicePanel");
  const bohnanzaDiceHeaderActions = document.getElementById("bohnanzaDiceHeaderActions");
  const bohnanzaDiceHelpBtn = document.getElementById("bohnanzaDiceHelpBtn");
  const bohnanzaDiceExplainBtn = document.getElementById("bohnanzaDiceExplainBtn");
  const bohnanzaDiceHelpModal = document.getElementById("bohnanzaDiceHelpModal");
  const bohnanzaDiceExplainModal = document.getElementById("bohnanzaDiceExplainModal");
  const bohnanzaDiceHelpCloseBtn = document.getElementById("bohnanzaDiceHelpCloseBtn");
  const bohnanzaDiceExplainCloseBtn = document.getElementById("bohnanzaDiceExplainCloseBtn");
  const bohnanzaDiceHelpContent = document.getElementById("bohnanzaDiceHelpContent");
  const bohnanzaDiceExplainContent = document.getElementById("bohnanzaDiceExplainContent");
  const bohnanzaDiceTurnLabel = document.getElementById("bohnanzaDiceTurnLabel");
  const bohnanzaDicePhaseLabel = document.getElementById("bohnanzaDicePhaseLabel");
  const bohnanzaDiceDeckLabel = document.getElementById("bohnanzaDiceDeckLabel");
  const bohnanzaDiceStatus = document.getElementById("bohnanzaDiceStatus");
  const bohnanzaDiceRepeatBadge = document.getElementById("bohnanzaDiceRepeatBadge");
  const bohnanzaDiceCurrentDice = document.getElementById("bohnanzaDiceCurrentDice");
  const bohnanzaDiceFieldDice = document.getElementById("bohnanzaDiceFieldDice");
  const bohnanzaDiceFieldCount = document.getElementById("bohnanzaDiceFieldCount");
  const bohnanzaDiceRollBtn = document.getElementById("bohnanzaDiceRollBtn");
  const bohnanzaDiceSaveBtn = document.getElementById("bohnanzaDiceSaveBtn");
  const bohnanzaDiceRepeatBtn = document.getElementById("bohnanzaDiceRepeatBtn");
  const bohnanzaDiceHarvestDock = document.getElementById("bohnanzaDiceHarvestDock");
  const bohnanzaDiceHarvestPrompt = document.getElementById("bohnanzaDiceHarvestPrompt");
  const bohnanzaDiceHarvestBtn = document.getElementById("bohnanzaDiceHarvestBtn");
  const bohnanzaDiceKeepBtn = document.getElementById("bohnanzaDiceKeepBtn");
  const bohnanzaDicePlayers = document.getElementById("bohnanzaDicePlayers");
  const bohnanzaDiceFinal = document.getElementById("bohnanzaDiceFinal");
  const bohnanzaDiceFinalTitle = document.getElementById("bohnanzaDiceFinalTitle");
  const bohnanzaDiceFinalDetail = document.getElementById("bohnanzaDiceFinalDetail");
  const bohnanzaDiceReadyList = document.getElementById("bohnanzaDiceReadyList");
  const bohnanzaDicePlayAgainBtn = document.getElementById("bohnanzaDicePlayAgainBtn");
  const bohnanzaDiceActivity = document.getElementById("bohnanzaDiceActivity");
  const bohnanzaDiceLiveRegion = document.getElementById("bohnanzaDiceLiveRegion");

  const BOHNANZA_DICE_BEANS = {
    garden: { emoji: "🌱", short: "GA", label: "Garden Bean" },
    red: { emoji: "🔥", short: "RE", label: "Red Bean" },
    soy: { emoji: "🫘", short: "SO", label: "Soy Bean" },
    green: { emoji: "🥬", short: "GR", label: "Green Bean" },
    stink: { emoji: "💨", short: "ST", label: "Stink Bean" },
    blue: { emoji: "💧", short: "BL", label: "Blue Bean" },
  };

  const BOHNANZA_DICE_PHASES = {
    await_roll: "Awaiting roll",
    after_roll: "Choose dice",
    harvest_decision: "Harvest decision",
    turn_end_harvest: "Turn-end harvest",
    final_harvest: "Final harvest",
    game_over: "Game over",
  };

  const BOHNANZA_DICE_EXPLANATIONS = {
    dice: {
      title: "Current Roll",
      body: "Only these freshly rolled dice help non-active players. If it is your turn, select one or more to lock into the bean field.",
    },
    field: {
      title: "Bean Field",
      body: "Saved dice cannot be taken back or rerolled. When all five are here, the active player checks their current harvest card once.",
    },
    roll: {
      title: "Roll Dice",
      body: "Start your turn by rolling all five dice. Later rolls happen automatically after you save at least one die.",
    },
    save: {
      title: "Save Selected",
      body: "Lock every selected die into the field and automatically reroll all remaining dice. You must select at least one.",
    },
    repeat: {
      title: "Repeat This Roll",
      body: "Once per turn, reroll every die in the current roll. Dice already saved in the field stay unchanged, and other players may use the new result again.",
    },
    harvest: {
      title: "Harvest",
      body: "Cash in 3, 4, or 5 completed orders for 1, 2, or 3 coins. Your cover card becomes the new current card and a new cover is drawn.",
    },
    keep: {
      title: "Keep Growing",
      body: "Skip harvesting at this checkpoint and keep your progress. During the final harvest this instead finishes your game without collecting these orders.",
    },
    card: {
      title: "Harvest Card",
      body: "Orders are completed from the bottom upward. Every slot in one OR branch needs its own matching die; the same dice may be reused for the next order.",
    },
    score: {
      title: "Bean Coins",
      body: "Each face-down harvest card is worth 1 coin. A gold 5 marker replaces five coin cards when the draw deck needs them back.",
    },
    activity: {
      title: "Harvest Log",
      body: "The server records rolls, progress, harvests, card recycling, and turn changes here. The log remains visible after the game ends.",
    },
    again: {
      title: "Play Again",
      body: "Confirm a fresh game with the same seats. Every human must confirm; bots are ready automatically.",
    },
  };

  const BOHNANZA_DICE_HELP_HTML = `
    <div class="bohnanza-dice-rules">
      <p class="bohnanza-dice-practice-note"><strong>Edition.</strong> This implementation follows the 2022 Version 2.0 game: five dice, five orders per card, and 10 coins to trigger the final harvest.</p>
      <h3>Goal &amp; Setup</h3>
      <p>Earn the most bean coins by completing orders. Every player receives two public harvest cards: the current card and a cover card waiting underneath it. The server shuffles the fixed 55-card catalog and chooses the first player.</p>
      <h3>The Five Dice</h3>
      <div class="bohnanza-dice-rule-grid">
        <div><strong>2 dark dice</strong><span>💧 Blue · 🌱 Garden · 💨 Stink ×2 · 🫘 Soy ×2</span></div>
        <div><strong>3 light dice</strong><span>💨 Stink · 🔥 Red · 💧 Blue ×2 · 🥬 Green ×2</span></div>
      </div>
      <p>Bean colors are always paired with an icon, a name, a two-letter key, and a pattern. “Green Bean” and “Garden Bean” are different bean IDs.</p>
      <h3>Active Player</h3>
      <ol>
        <li>Roll every die not already saved in the bean field.</li>
        <li>Other players automatically check their current card using <em>only that fresh roll</em>.</li>
        <li>After all harvest choices are settled, save at least one die. Every unsaved die rerolls automatically.</li>
        <li>Once all five dice are saved, check your own card with the complete bean field and pass the turn.</li>
      </ol>
      <p>Once per turn, before saving, the active player may repeat the entire current roll. Previously saved dice stay in the field. A turn cannot end early.</p>
      <h3>Orders</h3>
      <p>Complete orders from the bottom upward and stop at the first one that does not match. A row may offer whole alternatives marked OR. Within one alternative, every slot needs a distinct die. Dice are not spent between rows, so the same result can advance several orders in sequence.</p>
      <h3>Harvesting</h3>
      <p>At 3 / 4 / 5 completed orders, you may harvest 1 / 2 / 3 coins. Your current card becomes the first coin; extra reward cards come from the deck. The cover becomes current, a new cover is drawn, and the new card immediately checks the dice context when the rules allow it.</p>
      <p>Choose <strong>Keep Growing</strong> to retain progress and skip only the current checkpoint. Harvest choices pause the dice flow and resolve in seat order, so network speed never decides who can use a roll.</p>
      <h3>Final Harvest</h3>
      <p>After any harvest reaches 10 coins, the current roll is banked into the field and the active player receives their final full-field check. Every eligible player then gets one final harvest decision. Highest score wins; ties share the win.</p>
      <h3>Digital Notes</h3>
      <p>This game uses the fixed <strong>original-compatible-v1</strong> catalog: 55 original compatible cards built for the published dice and rules. It does not reproduce the commercial card faces. Percentages show the exact chance that a fresh five-die roll satisfies an order across all 7,776 face-index outcomes.</p>
      <p>If the draw deck is short, the server exchanges an eligible player's five single-coin cards for one 5-coin marker, shuffles those cards back, and keeps the score unchanged. Hidden information is limited to deck order and future dice results.</p>
    </div>
  `;

  function bohnanzaDiceSetModal(modal, visible, returnFocus) {
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

  function bohnanzaDicePlayer(view, playerId) {
    return (view.players || []).find((player) => player.player_id === playerId) || null;
  }

  function bohnanzaDicePlayerName(view, playerId) {
    const player = bohnanzaDicePlayer(view, playerId);
    return (player && (player.name || player.player_id)) || playerId || "-";
  }

  function bohnanzaDiceHasAction(actionType) {
    return Boolean(
      bohnanzaDiceView &&
        Array.isArray(bohnanzaDiceView.legal_actions) &&
        bohnanzaDiceView.legal_actions.includes(actionType)
    );
  }

  function bohnanzaDiceDispatch(action) {
    if (bohnanzaDicePending || typeof sendAction !== "function") return;
    bohnanzaDicePending = true;
    if (bohnanzaDicePendingTimer) window.clearTimeout(bohnanzaDicePendingTimer);
    bohnanzaDicePendingTimer = window.setTimeout(() => {
      bohnanzaDicePending = false;
      bohnanzaDicePendingTimer = null;
      if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
    }, 1800);
    sendAction(action);
    if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
  }

  function bohnanzaDiceBeanToken(beanId, compact = false) {
    const meta = BOHNANZA_DICE_BEANS[beanId] || { emoji: "?", short: "?", label: beanId || "Unknown bean" };
    const token = document.createElement("span");
    token.className = `bohnanza-dice-bean bean-${beanId}${compact ? " is-compact" : ""}`;
    token.title = meta.label;
    token.setAttribute("aria-label", meta.label);

    const emoji = document.createElement("span");
    emoji.className = "bohnanza-dice-bean-emoji";
    emoji.textContent = meta.emoji;
    emoji.setAttribute("aria-hidden", "true");
    const key = document.createElement("span");
    key.className = "bohnanza-dice-bean-key";
    key.textContent = meta.short;
    token.append(emoji, key);
    return token;
  }

  function bohnanzaDiceOrderText(order) {
    return (order.alternatives || [])
      .map((alternative) =>
        (alternative.slots || [])
          .map((slot) => (slot.allowed || []).map((beanId) => (BOHNANZA_DICE_BEANS[beanId] || {}).label || beanId).join(" or "))
          .join(" plus ")
      )
      .join(" OR ");
  }

  function bohnanzaDiceOrderVisual(order) {
    const visual = document.createElement("span");
    visual.className = "bohnanza-dice-order-visual";
    visual.setAttribute("aria-label", bohnanzaDiceOrderText(order));
    (order.alternatives || []).forEach((alternative, alternativeIndex) => {
      if (alternativeIndex) {
        const or = document.createElement("span");
        or.className = "bohnanza-dice-order-or";
        or.textContent = "OR";
        visual.appendChild(or);
      }
      const group = document.createElement("span");
      group.className = "bohnanza-dice-order-group";
      (alternative.slots || []).forEach((slot) => {
        const slotEl = document.createElement("span");
        slotEl.className = "bohnanza-dice-order-slot";
        (slot.allowed || []).forEach((beanId, beanIndex) => {
          if (beanIndex) {
            const slash = document.createElement("span");
            slash.className = "bohnanza-dice-slot-or";
            slash.textContent = "/";
            slash.setAttribute("aria-hidden", "true");
            slotEl.appendChild(slash);
          }
          slotEl.appendChild(bohnanzaDiceBeanToken(beanId, true));
        });
        group.appendChild(slotEl);
      });
      visual.appendChild(group);
    });
    return visual;
  }

  function bohnanzaDiceCard(card, completedCount, kind) {
    const article = document.createElement("article");
    article.className = `bohnanza-dice-harvest-card is-${kind}`;
    article.dataset.bohnanzaDiceExplain = "card";

    const header = document.createElement("header");
    const label = document.createElement("strong");
    label.textContent = kind === "current" ? "Current card" : "Cover card";
    const cardKey = document.createElement("span");
    cardKey.textContent = card && card.id ? `#${String(card.id).slice(-3)}` : "-";
    header.append(label, cardKey);

    const orders = document.createElement("ol");
    orders.className = "bohnanza-dice-orders";
    const source = card && Array.isArray(card.orders_bottom_to_top) ? card.orders_bottom_to_top : [];
    source
      .map((order, index) => ({ order, index }))
      .reverse()
      .forEach(({ order, index }) => {
        const row = document.createElement("li");
        row.className = "bohnanza-dice-order-row";
        if (kind === "current" && index < completedCount) row.classList.add("is-complete");
        if (kind === "current" && index === completedCount) row.classList.add("is-next");

        const level = document.createElement("span");
        level.className = "bohnanza-dice-order-level";
        level.textContent = kind === "current" && index < completedCount ? "✓" : String(index + 1);
        const visual = bohnanzaDiceOrderVisual(order);
        const probability = document.createElement("span");
        probability.className = "bohnanza-dice-order-probability";
        const percent = Number(order.first_roll_percent);
        probability.textContent = Number.isFinite(percent) ? `${percent.toFixed(percent < 10 ? 1 : 0)}%` : "-";
        probability.title = "Chance a fresh five-die roll satisfies this order";
        row.append(level, visual, probability);
        orders.appendChild(row);
      });

    article.append(header, orders);
    return article;
  }

  function bohnanzaDiceBadge(text, className = "") {
    const badge = document.createElement("span");
    badge.className = `bohnanza-dice-badge${className ? ` ${className}` : ""}`;
    badge.textContent = text;
    return badge;
  }

  function bohnanzaDiceRenderPlayers(view) {
    if (!bohnanzaDicePlayers) return;
    bohnanzaDicePlayers.innerHTML = "";
    (view.players || []).forEach((player) => {
      const card = document.createElement("article");
      card.className = "bohnanza-dice-player";
      if (player.player_id === view.you) card.classList.add("is-self");
      if (player.player_id === view.active_player_id) card.classList.add("is-active");
      if ((view.harvest_queue || [])[0] === player.player_id) card.classList.add("is-deciding");
      if ((view.winner_ids || []).includes(player.player_id)) card.classList.add("is-winner");

      const heading = document.createElement("div");
      heading.className = "bohnanza-dice-player-heading";
      const identity = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      const badges = document.createElement("span");
      badges.className = "bohnanza-dice-player-badges";
      if (player.player_id === view.you) badges.appendChild(bohnanzaDiceBadge("You"));
      if (player.player_id === view.active_player_id) badges.appendChild(bohnanzaDiceBadge("Roller", "is-active"));
      if (player.is_bot) badges.appendChild(bohnanzaDiceBadge("Bot"));
      if ((view.harvest_queue || [])[0] === player.player_id) badges.appendChild(bohnanzaDiceBadge("Deciding", "is-decision"));
      identity.append(name, badges);

      const score = document.createElement("div");
      score.className = "bohnanza-dice-score";
      score.dataset.bohnanzaDiceExplain = "score";
      const scoreValue = document.createElement("strong");
      scoreValue.textContent = String(Number(player.score || 0));
      const scoreLabel = document.createElement("span");
      scoreLabel.textContent = "coins";
      score.append(scoreValue, scoreLabel);
      heading.append(identity, score);

      const cardPair = document.createElement("div");
      cardPair.className = "bohnanza-dice-card-pair";
      cardPair.append(
        bohnanzaDiceCard(player.top_card || {}, Number(player.completed_count || 0), "current"),
        bohnanzaDiceCard(player.cover_card || {}, 0, "cover")
      );

      const footer = document.createElement("div");
      footer.className = "bohnanza-dice-player-footer";
      const progress = document.createElement("span");
      progress.textContent = `${Number(player.completed_count || 0)} / 5 orders`;
      const wallet = document.createElement("span");
      wallet.textContent = `${player.five_coin_marker ? "🟡 5 + " : ""}🂠 ${Number(player.single_coin_count || 0)}`;
      wallet.title = player.five_coin_marker ? "One 5-coin marker plus single coin cards" : "Single coin cards";
      footer.append(progress, wallet);
      card.append(heading, cardPair, footer);
      bohnanzaDicePlayers.appendChild(card);
    });
  }

  function bohnanzaDiceDie(die, selectable) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `bohnanza-dice-die is-${die.template} bean-${die.face}`;
    button.dataset.bohnanzaDiceExplain = "dice";
    const selected = bohnanzaDiceSelectedIds.has(die.id);
    if (selected) button.classList.add("is-selected");
    button.disabled = !selectable || bohnanzaDicePending;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    const meta = BOHNANZA_DICE_BEANS[die.face] || { label: "Unrolled", short: "-" };
    button.setAttribute("aria-label", `${die.template} die ${die.id}, ${meta.label}${selected ? ", selected" : ""}`);
    button.appendChild(bohnanzaDiceBeanToken(die.face));
    const template = document.createElement("span");
    template.className = "bohnanza-dice-die-template";
    template.textContent = die.template === "dark" ? "DARK" : "LIGHT";
    button.appendChild(template);
    button.addEventListener("click", () => {
      if (bohnanzaDiceExplainMode || button.disabled) return;
      if (bohnanzaDiceSelectedIds.has(die.id)) bohnanzaDiceSelectedIds.delete(die.id);
      else bohnanzaDiceSelectedIds.add(die.id);
      if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
    });
    return button;
  }

  function bohnanzaDiceEmptySlot(label) {
    const slot = document.createElement("span");
    slot.className = "bohnanza-dice-empty-slot";
    slot.textContent = "·";
    slot.setAttribute("aria-label", label);
    return slot;
  }

  function bohnanzaDiceRenderDice(view) {
    const dice = Array.isArray(view.dice) ? view.dice : [];
    const current = dice.filter((die) => die.zone === "current_roll");
    const field = dice.filter((die) => die.zone === "bean_field");
    const selectable = bohnanzaDiceHasAction("save_dice");
    const legalIds = new Set(view.selectable_die_ids || []);
    bohnanzaDiceSelectedIds.forEach((dieId) => {
      if (!legalIds.has(dieId)) bohnanzaDiceSelectedIds.delete(dieId);
    });

    if (bohnanzaDiceCurrentDice) {
      bohnanzaDiceCurrentDice.innerHTML = "";
      if (current.length) current.forEach((die) => bohnanzaDiceCurrentDice.appendChild(bohnanzaDiceDie(die, selectable)));
      else {
        const empty = document.createElement("div");
        empty.className = "bohnanza-dice-empty-message";
        empty.textContent = view.phase === "await_roll" ? "The dice are ready in the cup." : "No fresh dice are waiting.";
        bohnanzaDiceCurrentDice.appendChild(empty);
      }
    }

    if (bohnanzaDiceFieldDice) {
      bohnanzaDiceFieldDice.innerHTML = "";
      field.forEach((die) => bohnanzaDiceFieldDice.appendChild(bohnanzaDiceDie(die, false)));
      for (let index = field.length; index < 5; index += 1) {
        bohnanzaDiceFieldDice.appendChild(bohnanzaDiceEmptySlot(`Empty field slot ${index + 1}`));
      }
    }
    if (bohnanzaDiceFieldCount) bohnanzaDiceFieldCount.textContent = `${field.length} / 5`;
  }

  function bohnanzaDiceRenderActions(view) {
    if (bohnanzaDiceRollBtn) {
      bohnanzaDiceRollBtn.disabled = !bohnanzaDiceHasAction("roll") || bohnanzaDicePending;
      bohnanzaDiceRollBtn.textContent = "Roll 5 Dice";
    }
    if (bohnanzaDiceSaveBtn) {
      bohnanzaDiceSaveBtn.disabled = !bohnanzaDiceHasAction("save_dice") || !bohnanzaDiceSelectedIds.size || bohnanzaDicePending;
      bohnanzaDiceSaveBtn.textContent = bohnanzaDiceSelectedIds.size
        ? `Save ${bohnanzaDiceSelectedIds.size} ${bohnanzaDiceSelectedIds.size === 1 ? "Die" : "Dice"}`
        : "Save Selected";
    }
    if (bohnanzaDiceRepeatBtn) {
      bohnanzaDiceRepeatBtn.disabled = !bohnanzaDiceHasAction("repeat_roll") || bohnanzaDicePending;
    }
    if (bohnanzaDiceRepeatBadge) {
      bohnanzaDiceRepeatBadge.textContent = view.repeat_used ? "Repeat used" : "Repeat ready";
      bohnanzaDiceRepeatBadge.classList.toggle("is-used", Boolean(view.repeat_used));
    }

    const offer = view.harvest_offer;
    if (bohnanzaDiceHarvestDock) bohnanzaDiceHarvestDock.classList.toggle("hidden", !offer);
    if (offer) {
      const name = bohnanzaDicePlayerName(view, offer.player_id);
      const isYou = offer.player_id === view.you;
      if (bohnanzaDiceHarvestPrompt) {
        bohnanzaDiceHarvestPrompt.textContent = `${isYou ? "You have" : `${name} has`} ${offer.completed_count} completed orders worth ${offer.reward} ${offer.reward === 1 ? "coin" : "coins"}.`;
      }
      if (bohnanzaDiceHarvestBtn) {
        bohnanzaDiceHarvestBtn.textContent = `Harvest ${offer.reward} ${offer.reward === 1 ? "Coin" : "Coins"}`;
        bohnanzaDiceHarvestBtn.disabled = !bohnanzaDiceHasAction("harvest") || bohnanzaDicePending;
      }
      if (bohnanzaDiceKeepBtn) {
        bohnanzaDiceKeepBtn.textContent = offer.final ? "Finish Without Harvesting" : "Keep Growing";
        bohnanzaDiceKeepBtn.disabled = !bohnanzaDiceHasAction("keep_growing") || bohnanzaDicePending;
      }
    }
  }

  function bohnanzaDiceRenderStatus(view) {
    if (!bohnanzaDiceStatus) return;
    const activeName = bohnanzaDicePlayerName(view, view.active_player_id);
    const head = (view.harvest_queue || [])[0];
    if (view.game_over) {
      const winners = (view.winner_ids || []).map((id) => bohnanzaDicePlayerName(view, id));
      bohnanzaDiceStatus.textContent = winners.length
        ? `🏆 ${winners.join(" & ")} ${winners.length === 1 ? "wins" : "win"}. Final cards and scores remain on the table.`
        : "Game over. Final cards and scores remain on the table.";
    } else if (head) {
      const name = bohnanzaDicePlayerName(view, head);
      bohnanzaDiceStatus.textContent = head === view.you
        ? `${view.phase === "final_harvest" ? "Final decision" : "Harvest decision"} — collect now or keep growing.`
        : `Waiting for ${name}'s ${view.phase === "final_harvest" ? "final " : ""}harvest decision.`;
    } else if (view.phase === "await_roll") {
      bohnanzaDiceStatus.textContent = view.active_player_id === view.you
        ? "Your turn — roll all five dice."
        : `Waiting for ${activeName} to roll.`;
    } else if (view.phase === "after_roll") {
      bohnanzaDiceStatus.textContent = view.active_player_id === view.you
        ? "Select at least one fresh die to save. Tap open space to clear your selection."
        : `${activeName} is choosing dice for the bean field.`;
    } else if (view.phase === "final_harvest") {
      bohnanzaDiceStatus.textContent = "The 10-coin threshold was reached. Final harvests are resolving.";
    } else {
      bohnanzaDiceStatus.textContent = "Waiting for the next server decision.";
    }
  }

  function bohnanzaDiceActivityText(view, item) {
    const name = bohnanzaDicePlayerName(view, item.player_id);
    if (item.type === "roll") {
      const faces = (item.dice || []).map((die) => (BOHNANZA_DICE_BEANS[die.face] || {}).short || die.face).join(" · ");
      return `${name} rolled ${faces || `${item.die_count || 0} dice`}.`;
    }
    if (item.type === "orders_advanced") return `${name} completed ${item.gained} order${item.gained === 1 ? "" : "s"} (${item.completed_count}/5).`;
    if (item.type === "dice_saved") return `${name} saved ${(item.die_ids || []).length} dice.`;
    if (item.type === "repeat_roll") return `${name} used the once-per-turn repeat.`;
    if (item.type === "harvest") return `${name} harvested ${item.reward} coin${item.reward === 1 ? "" : "s"} and now has ${item.score}.`;
    if (item.type === "keep_growing") return item.final ? `${name} finished without another harvest.` : `${name} kept growing.`;
    if (item.type === "cards_recycled") return `${name} exchanged five coin cards for a 5-coin marker; those cards returned to the deck.`;
    if (item.type === "final_phase") return `${name} reached ${item.score} coins. Final harvest began.`;
    if (item.type === "turn_started") return `${name}'s turn began.`;
    if (item.type === "game_over") return "Final harvest complete.";
    return item.message || item.type || "Game updated.";
  }

  function bohnanzaDiceRenderActivity(view) {
    if (!bohnanzaDiceActivity) return;
    bohnanzaDiceActivity.innerHTML = "";
    const activity = Array.isArray(view.activity) ? [...view.activity].reverse() : [];
    if (!activity.length) {
      bohnanzaDiceActivity.textContent = "No actions yet.";
      return;
    }
    activity.forEach((item) => {
      const row = document.createElement("div");
      row.className = "bohnanza-dice-activity-row";
      const sequence = document.createElement("span");
      sequence.textContent = `#${item.sequence}`;
      const copy = document.createElement("p");
      copy.textContent = bohnanzaDiceActivityText(view, item);
      row.append(sequence, copy);
      bohnanzaDiceActivity.appendChild(row);
    });

    const latest = activity[0];
    if (bohnanzaDiceLiveRegion && Number(latest.sequence || 0) > bohnanzaDiceLastAnnounced) {
      bohnanzaDiceLastAnnounced = Number(latest.sequence || 0);
      bohnanzaDiceLiveRegion.textContent = bohnanzaDiceActivityText(view, latest);
    }
  }

  function bohnanzaDiceRenderFinal(view) {
    if (!bohnanzaDiceFinal) return;
    bohnanzaDiceFinal.classList.toggle("hidden", !view.game_over);
    if (!view.game_over) return;
    const winners = (view.winner_ids || []).map((id) => bohnanzaDicePlayerName(view, id));
    const winningScores = (view.players || []).filter((player) => (view.winner_ids || []).includes(player.player_id)).map((player) => Number(player.score || 0));
    const score = winningScores.length ? Math.max(...winningScores) : 0;
    if (bohnanzaDiceFinalTitle) {
      bohnanzaDiceFinalTitle.textContent = winners.length
        ? `${winners.join(" & ")} ${winners.length === 1 ? "Wins" : "Win"}`
        : "Game Over";
    }
    if (bohnanzaDiceFinalDetail) {
      bohnanzaDiceFinalDetail.textContent = winners.length
        ? `${score} coins. Tied leaders share the win. Review the final table for as long as you like.`
        : "Review the final table for as long as you like.";
    }
    if (bohnanzaDiceReadyList) {
      bohnanzaDiceReadyList.innerHTML = "";
      (view.players || []).forEach((player) => {
        const ready = (view.rematch_ready || []).includes(player.player_id);
        bohnanzaDiceReadyList.appendChild(bohnanzaDiceBadge(`${ready ? "✓" : "○"} ${player.name || player.player_id}`));
      });
    }
    if (bohnanzaDicePlayAgainBtn) {
      const ready = (view.rematch_ready || []).includes(view.you);
      bohnanzaDicePlayAgainBtn.textContent = ready ? "Rematch Ready ✓" : "Play Again";
      bohnanzaDicePlayAgainBtn.disabled = !bohnanzaDiceHasAction("play_again") || bohnanzaDicePending;
    }
  }

  function bohnanzaDiceSetExplainMode(enabled) {
    bohnanzaDiceExplainMode = Boolean(enabled);
    document.body.classList.toggle("bohnanza-dice-explain-mode", bohnanzaDiceExplainMode);
    if (bohnanzaDiceExplainBtn) bohnanzaDiceExplainBtn.setAttribute("aria-pressed", bohnanzaDiceExplainMode ? "true" : "false");
    document.querySelectorAll("[data-bohnanza-dice-explain]").forEach((element) => {
      element.classList.toggle("has-explanation", bohnanzaDiceExplainMode);
    });
  }

  function bohnanzaDiceRefreshExplainTargets() {
    if (!bohnanzaDiceExplainMode) return;
    document.querySelectorAll("[data-bohnanza-dice-explain]").forEach((element) => element.classList.add("has-explanation"));
  }

  function bohnanzaDiceShowExplanation(key) {
    const explanation = BOHNANZA_DICE_EXPLANATIONS[key];
    if (!explanation || !bohnanzaDiceExplainContent) return;
    bohnanzaDiceExplainContent.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = explanation.title;
    const body = document.createElement("p");
    body.textContent = explanation.body;
    bohnanzaDiceExplainContent.append(title, body);
    bohnanzaDiceSetModal(bohnanzaDiceExplainModal, true);
  }

  function bohnanzaDiceFindDisabledExplainTarget(x, y) {
    const targets = document.querySelectorAll("button[data-bohnanza-dice-explain]:disabled");
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return target;
    }
    return null;
  }

  function bohnanzaDiceRenderInteractive(view) {
    bohnanzaDiceRenderDice(view);
    bohnanzaDiceRenderActions(view);
    bohnanzaDiceRenderStatus(view);
    bohnanzaDiceRenderFinal(view);
    bohnanzaDiceRefreshExplainTargets();
  }

  function bohnanzaDiceRenderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    bohnanzaDiceView = view;
    bohnanzaDicePending = false;
    if (bohnanzaDicePendingTimer) window.clearTimeout(bohnanzaDicePendingTimer);
    bohnanzaDicePendingTimer = null;
    const selectable = new Set(view.selectable_die_ids || []);
    bohnanzaDiceSelectedIds.forEach((dieId) => {
      if (!selectable.has(dieId)) bohnanzaDiceSelectedIds.delete(dieId);
    });

    if (typeof currentGameType !== "undefined" && currentGameType !== "bohnanza_dice") {
      currentGameType = "bohnanza_dice";
      setGamePanelVisibility("bohnanza_dice");
    }
    if (bohnanzaDiceTurnLabel) bohnanzaDiceTurnLabel.textContent = bohnanzaDicePlayerName(view, view.active_player_id);
    if (bohnanzaDicePhaseLabel) bohnanzaDicePhaseLabel.textContent = BOHNANZA_DICE_PHASES[view.phase] || view.phase || "-";
    if (bohnanzaDiceDeckLabel) bohnanzaDiceDeckLabel.textContent = String(Number(view.draw_deck_count || 0));
    bohnanzaDiceRenderPlayers(view);
    bohnanzaDiceRenderInteractive(view);
    bohnanzaDiceRenderActivity(view);
  }

  function bohnanzaDiceClearState() {
    bohnanzaDiceView = null;
    bohnanzaDiceSelectedIds.clear();
    bohnanzaDicePending = false;
    bohnanzaDiceLastAnnounced = 0;
    if (bohnanzaDicePendingTimer) window.clearTimeout(bohnanzaDicePendingTimer);
    bohnanzaDicePendingTimer = null;
    bohnanzaDiceSetExplainMode(false);
    bohnanzaDiceSetModal(bohnanzaDiceHelpModal, false);
    bohnanzaDiceSetModal(bohnanzaDiceExplainModal, false);
    [bohnanzaDiceCurrentDice, bohnanzaDiceFieldDice, bohnanzaDicePlayers, bohnanzaDiceReadyList].forEach((element) => {
      if (element) element.innerHTML = "";
    });
    if (bohnanzaDiceStatus) bohnanzaDiceStatus.textContent = "Waiting for game state…";
    if (bohnanzaDiceActivity) bohnanzaDiceActivity.textContent = "No actions yet.";
    if (bohnanzaDiceHarvestDock) bohnanzaDiceHarvestDock.classList.add("hidden");
    if (bohnanzaDiceFinal) bohnanzaDiceFinal.classList.add("hidden");
  }

  function bohnanzaDiceShowHeaderActions(show) {
    if (bohnanzaDiceHeaderActions) bohnanzaDiceHeaderActions.style.display = show ? "flex" : "none";
    if (!show) {
      bohnanzaDiceSelectedIds.clear();
      bohnanzaDiceSetExplainMode(false);
      bohnanzaDiceSetModal(bohnanzaDiceHelpModal, false);
      bohnanzaDiceSetModal(bohnanzaDiceExplainModal, false);
    }
  }

  if (bohnanzaDiceHelpContent) bohnanzaDiceHelpContent.innerHTML = BOHNANZA_DICE_HELP_HTML;
  if (bohnanzaDiceRollBtn) bohnanzaDiceRollBtn.addEventListener("click", () => bohnanzaDiceHasAction("roll") && bohnanzaDiceDispatch({ type: "roll" }));
  if (bohnanzaDiceSaveBtn) {
    bohnanzaDiceSaveBtn.addEventListener("click", () => {
      if (!bohnanzaDiceHasAction("save_dice") || !bohnanzaDiceSelectedIds.size) return;
      const dieIds = [...bohnanzaDiceSelectedIds];
      bohnanzaDiceSelectedIds.clear();
      bohnanzaDiceDispatch({ type: "save_dice", die_ids: dieIds });
    });
  }
  if (bohnanzaDiceRepeatBtn) bohnanzaDiceRepeatBtn.addEventListener("click", () => bohnanzaDiceHasAction("repeat_roll") && bohnanzaDiceDispatch({ type: "repeat_roll" }));
  if (bohnanzaDiceHarvestBtn) bohnanzaDiceHarvestBtn.addEventListener("click", () => bohnanzaDiceHasAction("harvest") && bohnanzaDiceDispatch({ type: "harvest" }));
  if (bohnanzaDiceKeepBtn) bohnanzaDiceKeepBtn.addEventListener("click", () => bohnanzaDiceHasAction("keep_growing") && bohnanzaDiceDispatch({ type: "keep_growing" }));
  if (bohnanzaDicePlayAgainBtn) bohnanzaDicePlayAgainBtn.addEventListener("click", () => bohnanzaDiceHasAction("play_again") && bohnanzaDiceDispatch({ type: "play_again" }));
  if (bohnanzaDiceHelpBtn) bohnanzaDiceHelpBtn.addEventListener("click", () => bohnanzaDiceSetModal(bohnanzaDiceHelpModal, true));
  if (bohnanzaDiceExplainBtn) bohnanzaDiceExplainBtn.addEventListener("click", () => bohnanzaDiceSetExplainMode(!bohnanzaDiceExplainMode));
  if (bohnanzaDiceHelpCloseBtn) bohnanzaDiceHelpCloseBtn.addEventListener("click", () => bohnanzaDiceSetModal(bohnanzaDiceHelpModal, false, bohnanzaDiceHelpBtn));
  if (bohnanzaDiceExplainCloseBtn) bohnanzaDiceExplainCloseBtn.addEventListener("click", () => bohnanzaDiceSetModal(bohnanzaDiceExplainModal, false));

  [bohnanzaDiceHelpModal, bohnanzaDiceExplainModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) bohnanzaDiceSetModal(modal, false, modal === bohnanzaDiceHelpModal ? bohnanzaDiceHelpBtn : null);
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!bohnanzaDiceExplainMode || typeof currentGameType === "undefined" || currentGameType !== "bohnanza_dice") return;
      const button = event.target.closest("button");
      if (!button) return;
      if ([bohnanzaDiceHelpBtn, bohnanzaDiceExplainBtn, bohnanzaDiceHelpCloseBtn, bohnanzaDiceExplainCloseBtn].includes(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const target = button.closest("[data-bohnanza-dice-explain]");
      if (target && target.dataset.bohnanzaDiceExplain) {
        bohnanzaDiceShowExplanation(target.dataset.bohnanzaDiceExplain);
        bohnanzaDiceSetExplainMode(false);
      }
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!bohnanzaDiceExplainMode || typeof currentGameType === "undefined" || currentGameType !== "bohnanza_dice") return;
      const target = bohnanzaDiceFindDisabledExplainTarget(event.clientX, event.clientY);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      bohnanzaDiceShowExplanation(target.dataset.bohnanzaDiceExplain);
      bohnanzaDiceSetExplainMode(false);
    },
    true
  );

  document.addEventListener("pointerdown", (event) => {
    if (
      bohnanzaDiceExplainMode ||
      !bohnanzaDiceSelectedIds.size ||
      typeof currentGameType === "undefined" ||
      currentGameType !== "bohnanza_dice" ||
      !bohnanzaDicePanel ||
      !bohnanzaDicePanel.contains(event.target)
    ) {
      return;
    }
    if (event.target.closest(".bohnanza-dice-die, .bohnanza-dice-actions")) return;
    bohnanzaDiceSelectedIds.clear();
    if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (bohnanzaDiceExplainMode) bohnanzaDiceSetExplainMode(false);
    if (bohnanzaDiceSelectedIds.size) {
      bohnanzaDiceSelectedIds.clear();
      if (bohnanzaDiceView) bohnanzaDiceRenderInteractive(bohnanzaDiceView);
    }
    if (bohnanzaDiceHelpModal && !bohnanzaDiceHelpModal.classList.contains("hidden")) bohnanzaDiceSetModal(bohnanzaDiceHelpModal, false, bohnanzaDiceHelpBtn);
    if (bohnanzaDiceExplainModal && !bohnanzaDiceExplainModal.classList.contains("hidden")) bohnanzaDiceSetModal(bohnanzaDiceExplainModal, false);
  });

  window.clearBohnanzaDiceState = bohnanzaDiceClearState;
  window.renderBohnanzaDiceGameState = bohnanzaDiceRenderGameState;
  window.showBohnanzaDiceHeaderActions = bohnanzaDiceShowHeaderActions;
})();
