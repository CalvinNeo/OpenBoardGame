(() => {
  "use strict";

  let emeraldSkullsView = null;
  let emeraldSkullsPending = false;
  let emeraldSkullsPendingTimer = null;
  let emeraldSkullsExplainMode = false;
  let emeraldSkullsLastAnnounced = 0;
  let emeraldSkullsMobileContext = "";
  let emeraldSkullsTipTimer = null;
  let emeraldSkullsTipTarget = null;
  let emeraldSkullsModalFocus = null;
  let emeraldSkullsSuppressClick = false;
  const emeraldSkullsSelectedDice = new Set();

  const emeraldSkullsPanel = document.getElementById("emeraldSkullsPanel");
  const emeraldSkullsHeaderActions = document.getElementById("emeraldSkullsHeaderActions");
  const emeraldSkullsHelpBtn = document.getElementById("emeraldSkullsHelpBtn");
  const emeraldSkullsExplainBtn = document.getElementById("emeraldSkullsExplainBtn");
  const emeraldSkullsHelpModal = document.getElementById("emeraldSkullsHelpModal");
  const emeraldSkullsExplainModal = document.getElementById("emeraldSkullsExplainModal");
  const emeraldSkullsHelpCloseBtn = document.getElementById("emeraldSkullsHelpCloseBtn");
  const emeraldSkullsExplainCloseBtn = document.getElementById("emeraldSkullsExplainCloseBtn");
  const emeraldSkullsHelpContent = document.getElementById("emeraldSkullsHelpContent");
  const emeraldSkullsExplainContent = document.getElementById("emeraldSkullsExplainContent");
  const emeraldSkullsTurnLabel = document.getElementById("emeraldSkullsTurnLabel");
  const emeraldSkullsTumblerLabel = document.getElementById("emeraldSkullsTumblerLabel");
  const emeraldSkullsPotLabel = document.getElementById("emeraldSkullsPotLabel");
  const emeraldSkullsStatus = document.getElementById("emeraldSkullsStatus");
  const emeraldSkullsPlayers = document.getElementById("emeraldSkullsPlayers");
  const emeraldSkullsFloorLabel = document.getElementById("emeraldSkullsFloorLabel");
  const emeraldSkullsBoard = document.getElementById("emeraldSkullsBoard");
  const emeraldSkullsRollHeading = document.getElementById("emeraldSkullsRollHeading");
  const emeraldSkullsDiceCount = document.getElementById("emeraldSkullsDiceCount");
  const emeraldSkullsDiceTray = document.getElementById("emeraldSkullsDiceTray");
  const emeraldSkullsSelectionHint = document.getElementById("emeraldSkullsSelectionHint");
  const emeraldSkullsBuyDock = document.getElementById("emeraldSkullsBuyDock");
  const emeraldSkullsBuyOptions = document.getElementById("emeraldSkullsBuyOptions");
  const emeraldSkullsActionDock = document.getElementById("emeraldSkullsActionDock");
  const emeraldSkullsRollBtn = document.getElementById("emeraldSkullsRollBtn");
  const emeraldSkullsRerollBtn = document.getElementById("emeraldSkullsRerollBtn");
  const emeraldSkullsPickNoseBtn = document.getElementById("emeraldSkullsPickNoseBtn");
  const emeraldSkullsContinueBtn = document.getElementById("emeraldSkullsContinueBtn");
  const emeraldSkullsChickenBtn = document.getElementById("emeraldSkullsChickenBtn");
  const emeraldSkullsBustBtn = document.getElementById("emeraldSkullsBustBtn");
  const emeraldSkullsMarkersLabel = document.getElementById("emeraldSkullsMarkersLabel");
  const emeraldSkullsBetCards = document.getElementById("emeraldSkullsBetCards");
  const emeraldSkullsPayoutChoice = document.getElementById("emeraldSkullsPayoutChoice");
  const emeraldSkullsPayoutOptions = document.getElementById("emeraldSkullsPayoutOptions");
  const emeraldSkullsResult = document.getElementById("emeraldSkullsResult");
  const emeraldSkullsResultEyebrow = document.getElementById("emeraldSkullsResultEyebrow");
  const emeraldSkullsResultTitle = document.getElementById("emeraldSkullsResultTitle");
  const emeraldSkullsReviewProgress = document.getElementById("emeraldSkullsReviewProgress");
  const emeraldSkullsResultBody = document.getElementById("emeraldSkullsResultBody");
  const emeraldSkullsReadyList = document.getElementById("emeraldSkullsReadyList");
  const emeraldSkullsNextBtn = document.getElementById("emeraldSkullsNextBtn");
  const emeraldSkullsPlayAgainBtn = document.getElementById("emeraldSkullsPlayAgainBtn");
  const emeraldSkullsLog = document.getElementById("emeraldSkullsLog");
  const emeraldSkullsLiveRegion = document.getElementById("emeraldSkullsLiveRegion");

  const EMERALD_SKULLS_COSTS = { 3: 0, 4: 1, 5: 3, 6: 6, 7: 10 };
  const EMERALD_SKULLS_CAPACITY = { 1: 7, 2: 7, 3: 7, 4: 2, 5: 1 };
  const EMERALD_SKULLS_LEVELS = { 1: "🦷 Lower jaw", 2: "🦷 Upper jaw", 3: "👃 Nose", 4: "👁️ Eyes", 5: "💎 Gem" };
  const EMERALD_SKULLS_BET_ICONS = {
    pick_bust: "👃💥", mad_nargash: "💀💎", grim_grin: "🦷", emerald_skull: "💚💀",
    busted_fowl: "💥🐔", final_jewel: "💎", empty_hands: "🏃", empty_shiny: "✨",
  };
  const EMERALD_SKULLS_PHASES = {
    buy_dice: "Buy Dice",
    await_roll: "Bets Open",
    after_roll: "Place or Reroll",
    post_place: "Press or Stop",
    choose_payout: "Choose Payout",
    turn_result: "Turn Review",
    game_over: "Game Over",
  };
  const EMERALD_SKULLS_RESULTS = {
    bust_out: "💥 Bust Out",
    chicken_out: "🐔 Chicken Out",
    gem_out: "💎 Gem Out",
    run_out: "🏃 Run Out",
    double_out: "✨ Double Out",
  };
  const EMERALD_SKULLS_EXPLANATIONS = {
    players: {
      title: "Player Resources",
      body: "Gears (⚙️) are both points and the price of extra dice. Reroll cubes (🟩) buy rerolls. Gamblers have two bet markers (🎟️) on each tumbler's turn. Bot (🤖) identifies an AI player.",
    },
    board: {
      title: "The Skull Board",
      body: "Place dice on five ascending levels. Once you reach a level, all later placements must stay on that level or move higher.",
    },
    level: {
      title: "Skull Level",
      body: "Select one or more matching dice, then choose a highlighted level. A skull (💀) die is wild. Eyes (👁️) hold at most two dice; the gem (💎) holds one.",
    },
    dice: {
      title: "Dice in Hand",
      body: "Dice show ⚀ 1, ⚁ 2, ⚂ 3, ⚃ 4, ⚄ 5 or a wild skull (💀). Place one or more matching dice on exactly one level, or use a reroll. Unselected dice return to the hand.",
    },
    buy: {
      title: "Buy Dice",
      body: "Three dice are free. Four through seven dice cost 1, 3, 6, or 10 ⚙️. Paid gears return to the central pot.",
    },
    roll: {
      title: "Roll Dice (🎲)",
      body: "Roll Dice (🎲) closes the current betting window. The tumbler should allow a fair moment for gamblers to wager before rolling.",
    },
    reroll: {
      title: "Spend a Reroll Cube",
      body: "Spend one reroll cube (🟩), add one unused die if possible, reopen betting, then reroll every die still in hand.",
    },
    nose: {
      title: "Pick a Nose",
      body: "Pick a Nose (👃): retrieve one ordinary 3 from the nose and reroll it with every die in hand. This can be done twice; a wild skull (💀) cannot be retrieved.",
    },
    continue: {
      title: "Press Your Luck",
      body: "Press Your Luck (🔥): reopen betting and roll every remaining die. Your placement floor stays where it is, so later rolls become riskier.",
    },
    chicken: {
      title: "Chicken Out",
      body: "Chicken Out (🐔): stop safely and score the dice already placed. Wild skull (💀) dice do not score unless the turn reached the gem (💎).",
    },
    bust: {
      title: "Accept Bust",
      body: "Bust Out (💥): end the turn with no tumbler payout when the roll has no legal placement. This is offered when a reroll was available but you decline it.",
    },
    bets: {
      title: "Standard Bets",
      body: "Gamblers may place two markers while dice are in the tumbler's hand, including both on one outcome. Earlier markers sit lower in a stack and earn the larger listed payout.",
    },
    bet: {
      title: "Bet Outcome",
      body: "Click during Bets Open to lock one marker here. It cannot be moved. The number of payout values is also this stack's capacity.",
    },
    payout: {
      title: "Payout Choice",
      body: "An achieved jackpot replaces the normal skull-board payout. Compare the options and choose exactly one.",
    },
    result: {
      title: "Turn Review",
      body: "The tumbler is paid first, followed by winning bets in card order. The board remains visible until every player confirms Next Turn.",
    },
    next: {
      title: "Next Turn",
      body: "Confirm that you have reviewed the final dice and payouts. The next tumbler begins only after every player is ready.",
    },
    again: {
      title: "Play Again",
      body: "Confirm a fresh game with the same seats. Every human must confirm; bots are ready automatically.",
    },
    log: {
      title: "Game Log",
      body: "Rolls, placements, bets, payouts, and confirmations appear here with the newest event first.",
    },
  };

  const EMERALD_SKULLS_HELP_HTML = `
    <div class="emerald-skulls-rules">
      <p class="emerald-skulls-scope-note"><strong>Edition.</strong> This table implements the 2–6 player standard-bet game. Solitary opposition cards, advanced bets, and the 7–8 player expansion are not included.</p>
      <h3>Goal</h3>
      <p>Collect the most <strong>⚙️ gears</strong>. Players rotate as the <strong>tumbler</strong>; everyone else races to bet on the result. The game ends immediately when a payout empties the central gear pot.</p>
      <h3>At a glance</h3>
      <p><strong>Gears (⚙️)</strong> are your score and dice budget. <strong>Reroll cubes (🟩)</strong> rescue rolls. <strong>Bet markers (🎟️)</strong> lock wagers. Dice show <strong>⚀ 1 · ⚁ 2 · ⚂ 3 · ⚃ 4 · ⚄ 5</strong>; <strong>skull (💀)</strong> is wild. Hover over a symbol or tap it for a short tip. Tap empty space to deselect dice; press Esc to close a dialog or leave Explain.</p>
      <h3>Your turn as tumbler</h3>
      <ol>
        <li><strong>Buy Dice:</strong> take 3 for free, or pay 1 / 3 / 6 / 10 ⚙️ for 4 / 5 / 6 / 7 dice.</li>
        <li><strong>Allow Bets:</strong> while the dice are in your hand, give gamblers a fair chance to place markers.</li>
        <li><strong>Roll:</strong> roll every die in hand. Place one or more matching dice on exactly one legal skull level, or use a reroll action.</li>
        <li><strong>Check:</strong> a gem or an empty hand ends the turn. Otherwise Chicken Out safely or press your luck and roll again.</li>
      </ol>
      <h3>Placement</h3>
      <p>Levels match faces 1–5; <strong>💀 is wild</strong>. Later placements must be on the current <strong>floor (↑)</strong> or higher. Teeth (🦷) and nose (👃) have no practical limit, eyes (👁️) hold 2 dice, and the gem (💎) holds 1.</p>
      <div class="emerald-skulls-rule-grid">
        <article><strong>💥 Bust Out</strong><span>No legal placement; tumbler earns nothing.</span></article>
        <article><strong>🐔 Chicken Out</strong><span>Stop with dice still in hand.</span></article>
        <article><strong>💎 Gem Out</strong><span>Reach level 5 with dice left.</span></article>
        <article><strong>🏃 Run Out</strong><span>Place every die without reaching the gem.</span></article>
        <article><strong>✨ Double Out</strong><span>Reach the gem and place every die.</span></article>
      </div>
      <h3>Tumbler payout</h3>
      <table>
        <thead><tr><th>Level</th><th>Chicken / Gem</th><th>Run / Double</th></tr></thead>
        <tbody>
          <tr><td>💎 Gem</td><td>3 ⚙️</td><td>5 ⚙️</td></tr>
          <tr><td>👁️ Eyes</td><td>2 ⚙️</td><td>5 ⚙️</td></tr>
          <tr><td>👃 Nose</td><td>1 🟩</td><td>1 🟩</td></tr>
          <tr><td>🦷 Upper jaw</td><td>1 ⚙️</td><td>2 ⚙️</td></tr>
          <tr><td>🦷 Lower jaw</td><td>1 ⚙️</td><td>1 ⚙️</td></tr>
        </tbody>
      </table>
      <p>Wild 💀 dice score normally only after Gem Out or Double Out. They are ignored after Chicken Out or Run Out.</p>
      <h3>Reroll actions</h3>
      <ul>
        <li><strong>🟩 Spend Reroll:</strong> add an unused die if available, then reroll the full hand.</li>
        <li><strong>👃 Pick a Nose:</strong> retrieve one ordinary 3 from the nose. You may do this twice, but your placement floor remains level 3.</li>
      </ul>
      <h3>Jackpots</h3>
      <ul>
        <li><strong>Mad Nargash:</strong> Gem Out using only 💀 dice — 5 ⚙️ per placed die.</li>
        <li><strong>Grim Grin:</strong> Run Out using only teeth — 3 ⚙️ per ordinary 1/2 die; wilds pay nothing.</li>
        <li><strong>Emerald Skull:</strong> Double Out with 3 teeth, 1 nose, 2 eyes, and 1 gem — 30 ⚙️.</li>
      </ul>
      <h3>Bets and game end</h3>
      <ul>
        <li><strong>Pick n' Bust (👃💥):</strong> Bust Out after at least one Nose Pick.</li>
        <li><strong>Mad Nargash (💀💎):</strong> reach the gem using only wild skull dice.</li>
        <li><strong>Grim Grin (🦷):</strong> empty your hand onto the two jaw levels only.</li>
        <li><strong>Emerald Skull (💚💀):</strong> Double Out with a Full Skull.</li>
        <li><strong>Busted Fowl (💥🐔):</strong> Bust Out or Chicken Out.</li>
        <li><strong>Final Jewel (💎):</strong> Gem Out, including Double Out.</li>
        <li><strong>Empty Hands (🏃):</strong> Run Out, including Double Out.</li>
        <li><strong>Empty n' Shiny (✨):</strong> Double Out.</li>
      </ul>
      <p>Each gambler has two 🎟️ markers, and both may occupy the same outcome. Markers lock in place, and earlier markers receive the leftmost, larger payout. Double Out also satisfies Gem Out and Run Out bets. The tumbler is paid first, then cards 1–4, left side before right side. If the pot empties, payment stops and the richest player wins; ties use 🟩 cubes, then most recent tumbler.</p>
      <h3>Playing with AI</h3>
      <p>Add a Bot (🤖) in the room before starting. AI players buy dice, place dice, manage rerolls, choose payouts and bet using the public board. An AI tumbler allows 4.5 seconds before rolling while humans still have bet markers. Turns pause for every human to confirm Next Turn; bots confirm automatically.</p>
    </div>`;

  function emeraldSkullsSetModal(modal, visible, returnFocus = null) {
    if (!modal) return;
    emeraldSkullsHideTip();
    if (visible) {
      emeraldSkullsModalFocus = document.activeElement;
      emeraldSkullsSetExplainMode(false);
    }
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      const close = modal.querySelector("button");
      if (close) window.setTimeout(() => close.focus(), 0);
    } else if (returnFocus || emeraldSkullsModalFocus) {
      const target = returnFocus || emeraldSkullsModalFocus;
      if (target.isConnected) target.focus();
      emeraldSkullsModalFocus = null;
    }
  }

  function emeraldSkullsSetTip(element, text) {
    if (!element) return;
    element.dataset.emeraldSkullsTip = text;
    if (element.tagName !== "BUTTON" && !element.matches(".emerald-skulls-die, .emerald-skulls-bet-marker, .emerald-skulls-bet-vacancy")) element.tabIndex = 0;
  }

  function emeraldSkullsHideTip() {
    if (emeraldSkullsTipTimer) window.clearTimeout(emeraldSkullsTipTimer);
    emeraldSkullsTipTimer = null;
    if (emeraldSkullsTipTarget) emeraldSkullsTipTarget.removeAttribute("aria-describedby");
    emeraldSkullsTipTarget = null;
    const tip = document.getElementById("emeraldSkullsTip");
    if (tip) tip.classList.add("hidden");
  }

  function emeraldSkullsShowTip(target, autoHide = false) {
    if (emeraldSkullsExplainMode || !target || !target.dataset.emeraldSkullsTip) return;
    emeraldSkullsHideTip();
    let tip = document.getElementById("emeraldSkullsTip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "emeraldSkullsTip";
      tip.className = "emerald-skulls-tip";
      tip.setAttribute("role", "tooltip");
      document.body.appendChild(tip);
    }
    tip.textContent = target.dataset.emeraldSkullsTip;
    tip.classList.remove("hidden");
    emeraldSkullsTipTarget = target;
    target.setAttribute("aria-describedby", tip.id);
    const rect = target.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(12, Math.min(window.innerWidth - box.width - 12, rect.left + (rect.width - box.width) / 2))}px`;
    const top = rect.bottom + 8 + box.height <= window.innerHeight - 12 ? rect.bottom + 8 : rect.top - box.height - 8;
    tip.style.top = `${Math.max(12, Math.min(window.innerHeight - box.height - 12, top))}px`;
    if (autoHide) emeraldSkullsTipTimer = window.setTimeout(emeraldSkullsHideTip, 3000);
  }

  function emeraldSkullsSetMobileTab(tab) {
    if (!emeraldSkullsPanel) return;
    emeraldSkullsPanel.dataset.mobileTab = tab;
    emeraldSkullsPanel.querySelectorAll("[data-emerald-skulls-tab]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.emeraldSkullsTab === tab));
    });
    emeraldSkullsHideTip();
  }

  function emeraldSkullsHasAction(actionType) {
    return Boolean(emeraldSkullsView && (emeraldSkullsView.legal_actions || []).includes(actionType));
  }

  function emeraldSkullsDispatch(action) {
    if (emeraldSkullsPending) return;
    emeraldSkullsPending = true;
    if (emeraldSkullsPendingTimer) window.clearTimeout(emeraldSkullsPendingTimer);
    emeraldSkullsPendingTimer = window.setTimeout(() => {
      emeraldSkullsPending = false;
      emeraldSkullsPendingTimer = null;
      if (emeraldSkullsView) emeraldSkullsRenderInteractive(emeraldSkullsView);
    }, 2500);
    if (typeof sendAction === "function") sendAction(action);
    if (emeraldSkullsView) emeraldSkullsRenderInteractive(emeraldSkullsView);
  }

  function emeraldSkullsPlayer(view, playerId) {
    return (view.players || []).find((player) => player.player_id === playerId) || null;
  }

  function emeraldSkullsPlayerName(view, playerId) {
    const player = emeraldSkullsPlayer(view, playerId);
    return player ? player.name || player.player_id : playerId || "-";
  }

  function emeraldSkullsPlayerHue(view, playerId) {
    const player = emeraldSkullsPlayer(view, playerId);
    const seat = player && Number(player.seat || 0);
    return [158, 34, 205, 8, 222, 285][Math.abs(seat || 0) % 6];
  }

  function emeraldSkullsFaceText(face) {
    if (face === "skull") return "💀";
    return ({ 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄" })[Number(face)] || "?";
  }

  function emeraldSkullsResultText(result) {
    return EMERALD_SKULLS_RESULTS[result] || String(result || "Pending").replaceAll("_", " ");
  }

  function emeraldSkullsMakeDie(die, options = {}) {
    const element = document.createElement(options.button ? "button" : "span");
    if (options.button) element.type = "button";
    element.className = "emerald-skulls-die";
    if (die.face === "skull") element.classList.add("is-wild");
    if (options.selected) element.classList.add("is-selected");
    if (options.ghost) element.classList.add("is-ghost");
    element.textContent = options.ghost ? "?" : emeraldSkullsFaceText(die.face);
    const label = options.ghost ? "🎲 Unrolled die" : die.face === "skull" ? "💀 Wild skull · matches any level" : `${emeraldSkullsFaceText(die.face)} Face ${die.face} · ${EMERALD_SKULLS_LEVELS[die.face]}`;
    emeraldSkullsSetTip(element, label);
    element.setAttribute("aria-label", label);
    if (options.button) element.setAttribute("aria-pressed", String(Boolean(options.selected)));
    element.dataset.emeraldSkullsExplain = "dice";
    if (options.button) element.disabled = !options.selectable || emeraldSkullsPending;
    return element;
  }

  function emeraldSkullsSelectedLevels(view) {
    if (!emeraldSkullsSelectedDice.size) return [];
    const selected = [...emeraldSkullsSelectedDice];
    const boardCounts = {};
    (view.dice || []).filter((die) => die.zone === "board").forEach((die) => {
      boardCounts[die.level] = Number(boardCounts[die.level] || 0) + 1;
    });
    return Object.entries(view.placement_options || {})
      .filter(([level, dieIds]) => {
        const capacity = EMERALD_SKULLS_CAPACITY[Number(level)] - Number(boardCounts[level] || 0);
        return selected.length <= capacity && selected.every((dieId) => dieIds.includes(dieId));
      })
      .map(([level]) => Number(level));
  }

  function emeraldSkullsToggleDie(die) {
    if (!emeraldSkullsView || !emeraldSkullsHasAction("place_dice")) return;
    if (emeraldSkullsSelectedDice.has(die.die_id)) {
      emeraldSkullsSelectedDice.delete(die.die_id);
    } else {
      if (die.face !== "skull") {
        const diceById = new Map((emeraldSkullsView.dice || []).map((item) => [item.die_id, item]));
        [...emeraldSkullsSelectedDice].forEach((dieId) => {
          const selected = diceById.get(dieId);
          if (selected && selected.face !== "skull" && selected.face !== die.face) emeraldSkullsSelectedDice.delete(dieId);
        });
      }
      emeraldSkullsSelectedDice.add(die.die_id);
    }
    emeraldSkullsRenderBoard(emeraldSkullsView);
    emeraldSkullsRenderDice(emeraldSkullsView);
    emeraldSkullsRefreshExplainTargets();
  }

  function emeraldSkullsRenderBoard(view) {
    const validLevels = new Set(emeraldSkullsSelectedLevels(view));
    for (let level = 1; level <= 5; level += 1) {
      const slot = document.getElementById(`emeraldSkullsLevel${level}`);
      const levelButton = emeraldSkullsBoard && emeraldSkullsBoard.querySelector(`[data-level="${level}"]`);
      if (!slot || !levelButton) continue;
      slot.innerHTML = "";
      const placed = (view.dice || []).filter((die) => die.zone === "board" && Number(die.level) === level);
      placed.forEach((die) => slot.appendChild(emeraldSkullsMakeDie(die)));
      if (!placed.length) {
        const empty = document.createElement("span");
        empty.className = "emerald-skulls-empty-slot";
        empty.textContent = "·";
        empty.setAttribute("aria-hidden", "true");
        slot.appendChild(empty);
      }
      const canPlace = validLevels.has(level) && emeraldSkullsHasAction("place_dice") && !emeraldSkullsPending;
      levelButton.disabled = !canPlace;
      levelButton.classList.toggle("is-placeable", canPlace);
      levelButton.classList.toggle("is-below-floor", !view.result && level < Number(view.minimum_level || 1));
      levelButton.dataset.emeraldSkullsExplainTitle = `${EMERALD_SKULLS_LEVELS[level]} · Level ${level}`;
      levelButton.dataset.emeraldSkullsExplainBody = level === 5
        ? "The gem (💎) holds one die and immediately ends the turn. Empty hand + gem is a Double Out (✨)."
        : level === 4
          ? "The eyes (👁️) hold at most two dice. Reaching this level makes future rolls dangerous."
          : level === 3
            ? "Nose (👃) dice award reroll cubes (🟩). An ordinary 3 may later be retrieved with Pick a Nose (👃)."
            : "Teeth (🦷) accept matching dice. Their payout in gears (⚙️) depends on how the turn ends.";
      emeraldSkullsSetTip(levelButton, `${EMERALD_SKULLS_LEVELS[level]} · Level ${level}. ${levelButton.dataset.emeraldSkullsExplainBody}`);
    }
    if (emeraldSkullsFloorLabel) {
      emeraldSkullsFloorLabel.textContent = `↑ ${view.minimum_level || 1}+`;
      emeraldSkullsSetTip(emeraldSkullsFloorLabel, `Placement floor: level ${view.minimum_level || 1} or higher. Earlier levels are locked.`);
    }
  }

  function emeraldSkullsRenderDice(view) {
    if (!emeraldSkullsDiceTray) return;
    emeraldSkullsDiceTray.innerHTML = "";
    const rolled = (view.dice || []).filter((die) => die.zone === "rolled");
    const pool = (view.dice || []).filter((die) => die.zone === "pool");
    const supply = (view.dice || []).filter((die) => die.zone === "supply");
    const selectable = emeraldSkullsHasAction("place_dice");
    rolled.forEach((die) => {
      const button = emeraldSkullsMakeDie(die, {
        button: true,
        selectable,
        selected: emeraldSkullsSelectedDice.has(die.die_id),
      });
      button.addEventListener("click", () => emeraldSkullsToggleDie(die));
      emeraldSkullsDiceTray.appendChild(button);
    });
    pool.forEach((die) => emeraldSkullsDiceTray.appendChild(emeraldSkullsMakeDie(die, { ghost: true })));
    if (!rolled.length && !pool.length) {
      const empty = document.createElement("span");
      empty.className = "emerald-skulls-tray-empty";
      empty.textContent = view.phase === "buy_dice" ? "Choose 3–7 dice below." : "No dice remain in hand.";
      emeraldSkullsDiceTray.appendChild(empty);
    }
    const reviewing = view.phase === "turn_result" || view.game_over;
    if (emeraldSkullsDiceCount) {
      emeraldSkullsDiceCount.textContent = reviewing
        ? `${pool.length + rolled.length} unplaced · ${supply.length} supply`
        : `${rolled.length + pool.length} in hand · ${supply.length} supply`;
    }
    if (emeraldSkullsRollHeading) {
      emeraldSkullsRollHeading.textContent = reviewing
        ? "Final Dice"
        : rolled.length
          ? "Fresh Roll"
          : pool.length
            ? "Ready to Roll"
            : "Dice Pool";
    }
    if (emeraldSkullsSelectionHint) {
      const levels = emeraldSkullsSelectedLevels(view);
      emeraldSkullsSelectionHint.textContent = reviewing
        ? "The final board is locked until everyone finishes reviewing."
        : emeraldSkullsSelectedDice.size
        ? levels.length
          ? `${emeraldSkullsSelectedDice.size} selected · Place on level ${levels.join(" or ")}.`
          : "That selection does not fit a legal level."
        : rolled.length
          ? "Select matching dice, then choose a highlighted skull level."
          : pool.length
            ? "Bets are open while the dice wait in hand."
            : "Placed dice stay locked for this turn.";
    }
  }

  function emeraldSkullsRenderPlayers(view) {
    if (!emeraldSkullsPlayers) return;
    emeraldSkullsPlayers.innerHTML = "";
    (view.players || []).forEach((player) => {
      const card = document.createElement("article");
      card.className = "emerald-skulls-player";
      card.style.setProperty("--emerald-player-hue", emeraldSkullsPlayerHue(view, player.player_id));
      if (player.player_id === view.active_player_id) card.classList.add("is-tumbler");
      if (player.player_id === view.you) card.classList.add("is-you");
      const top = document.createElement("div");
      top.className = "emerald-skulls-player-top";
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      emeraldSkullsSetTip(name, name.textContent);
      const badge = document.createElement("span");
      badge.textContent = `${player.is_bot ? "🤖 " : ""}${player.player_id === view.active_player_id ? "Tumbler" : player.is_bot ? "Bot" : player.player_id === view.you ? "You" : "Gambler"}`;
      emeraldSkullsSetTip(badge, `${player.is_bot ? "Bot (🤖) · AI player. " : ""}${player.player_id === view.active_player_id ? "Tumbler: buys and rolls dice this turn." : "Gambler: bets on this turn's result."}`);
      top.append(name, badge);
      const resources = document.createElement("div");
      resources.className = "emerald-skulls-player-resources";
      resources.innerHTML = `<span>⚙️ <b>${Number(player.gears || 0)}</b></span><span>🟩 <b>${Number(player.reroll_cubes || 0)}</b></span><span>🎟️ <b>${Number(player.bet_markers_left || 0)}</b></span>`;
      ["Gears (⚙️): score and dice budget", "Reroll cubes (🟩): spend one to reroll and add a supply die", "Bet markers (🎟️): two wagers per tumbler turn"].forEach((tip, index) => emeraldSkullsSetTip(resources.children[index], tip));
      const note = document.createElement("small");
      if (view.phase === "turn_result") note.textContent = player.ready ? "Ready ✓" : "Reviewing…";
      else if (view.game_over) note.textContent = player.rematch_ready ? "Rematch ready ✓" : "Final score";
      else if ((player.bets || []).length) note.textContent = `${player.bets.length} bet${player.bets.length === 1 ? "" : "s"} locked`;
      else note.textContent = player.player_id === view.active_player_id ? "Rolling the bones" : "Watching the roll";
      card.append(top, resources, note);
      emeraldSkullsPlayers.appendChild(card);
    });
  }

  function emeraldSkullsMakeMarker(view, bet, position, payout) {
    const marker = document.createElement("span");
    marker.className = "emerald-skulls-bet-marker";
    marker.style.setProperty("--emerald-player-hue", emeraldSkullsPlayerHue(view, bet.player_id));
    emeraldSkullsSetTip(marker, `${emeraldSkullsPlayerName(view, bet.player_id)} · marker #${position} · ${payout} gears (⚙️) if this bet wins`);
    const initial = emeraldSkullsPlayerName(view, bet.player_id).trim().slice(0, 1).toUpperCase() || "?";
    const initialLabel = document.createElement("b");
    initialLabel.textContent = initial;
    const payoutLabel = document.createElement("small");
    payoutLabel.textContent = `${payout}⚙️`;
    marker.append(initialLabel, payoutLabel);
    marker.setAttribute("aria-label", `${emeraldSkullsPlayerName(view, bet.player_id)}, position ${position}, payout ${payout} gears`);
    return marker;
  }

  function emeraldSkullsRenderBets(view) {
    if (!emeraldSkullsBetCards) return;
    emeraldSkullsBetCards.innerHTML = "";
    const byCard = new Map();
    (view.betting_options || []).forEach((bet) => {
      if (!byCard.has(bet.card_number)) byCard.set(bet.card_number, []);
      byCard.get(bet.card_number).push(bet);
    });
    [...byCard.entries()].sort((a, b) => a[0] - b[0]).forEach(([cardNumber, bets]) => {
      const card = document.createElement("article");
      card.className = "emerald-skulls-bet-card";
      const number = document.createElement("span");
      number.className = "emerald-skulls-card-number";
      number.textContent = `Card ${cardNumber}`;
      emeraldSkullsSetTip(number, `Card ${cardNumber} · Bets pay in card order, left side first.`);
      card.appendChild(number);
      bets.sort((a, b) => (a.side === "left" ? -1 : 1) - (b.side === "left" ? -1 : 1)).forEach((bet) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "emerald-skulls-bet";
        button.dataset.emeraldSkullsExplain = "bet";
        const label = `${EMERALD_SKULLS_BET_ICONS[bet.bet_id] || "🎟️"} ${bet.name}`;
        button.dataset.emeraldSkullsExplainTitle = label;
        button.dataset.emeraldSkullsExplainBody = `${label}: ${bet.description}. Earlier markers receive ${bet.payouts.join(" / ")} gears (⚙️) in order. Double Out (✨) also wins Gem Out (💎) and Run Out (🏃) bets.`;
        emeraldSkullsSetTip(button, `${label} · ${bet.description}. ${bet.available ? "Tap to place one bet marker (🎟️)." : "Betting is closed or this stack is full."}`);
        if (bet.won === true) button.classList.add("is-winner");
        if (bet.won === false && view.result) button.classList.add("is-loser");
        button.disabled = !bet.available || !emeraldSkullsHasAction("place_bet") || emeraldSkullsPending;
        const heading = document.createElement("strong");
        heading.textContent = label;
        const description = document.createElement("span");
        description.className = "emerald-skulls-bet-description";
        description.textContent = bet.description;
        const stack = document.createElement("span");
        stack.className = "emerald-skulls-marker-stack";
        bet.payouts.forEach((payout, index) => {
          const markerBet = (bet.stack || [])[index];
          if (markerBet) stack.appendChild(emeraldSkullsMakeMarker(view, markerBet, index + 1, payout));
          else {
            const vacancy = document.createElement("span");
            vacancy.className = "emerald-skulls-bet-vacancy";
            vacancy.textContent = `${payout}⚙️`;
            emeraldSkullsSetTip(vacancy, `Marker #${index + 1} pays ${payout} gears (⚙️) if this bet wins.`);
            stack.appendChild(vacancy);
          }
        });
        button.append(heading, description, stack);
        button.addEventListener("click", () => {
          if (bet.available && emeraldSkullsHasAction("place_bet")) emeraldSkullsDispatch({ type: "place_bet", bet_id: bet.bet_id });
        });
        card.appendChild(button);
      });
      emeraldSkullsBetCards.appendChild(card);
    });
    const me = emeraldSkullsPlayer(view, view.you);
    if (emeraldSkullsMarkersLabel) {
      emeraldSkullsMarkersLabel.textContent = view.you === view.active_player_id ? "🎟️ Gamblers only" : `🎟️ ${me ? me.bet_markers_left : 0} left`;
      emeraldSkullsSetTip(emeraldSkullsMarkersLabel, "Bet markers (🎟️): each gambler has two per turn. The tumbler cannot bet.");
    }
  }

  function emeraldSkullsRenderBuy(view) {
    if (!emeraldSkullsBuyDock || !emeraldSkullsBuyOptions) return;
    const visible = view.phase === "buy_dice";
    emeraldSkullsBuyDock.classList.toggle("hidden", !visible);
    emeraldSkullsBuyOptions.innerHTML = "";
    if (!visible) return;
    const me = emeraldSkullsPlayer(view, view.you);
    Object.entries(EMERALD_SKULLS_COSTS).forEach(([countText, cost]) => {
      const count = Number(countText);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emerald-skulls-buy-button";
      if (count === 3) button.classList.add("is-primary");
      button.dataset.emeraldSkullsExplain = "buy";
      button.dataset.emeraldSkullsExplainTitle = `${count} Dice`;
      button.dataset.emeraldSkullsExplainBody = cost ? `Pay ${cost} gears (⚙️) to begin this turn with ${count} dice (🎲).` : "Begin this turn with three dice (🎲) for free.";
      emeraldSkullsSetTip(button, button.dataset.emeraldSkullsExplainBody);
      button.innerHTML = `<strong>${count} 🎲</strong><span>${cost ? `${cost} ⚙️` : "Free"}</span>`;
      button.disabled = !emeraldSkullsHasAction("buy_dice") || !me || Number(me.gears || 0) < cost || emeraldSkullsPending;
      button.addEventListener("click", () => emeraldSkullsDispatch({ type: "buy_dice", count }));
      emeraldSkullsBuyOptions.appendChild(button);
    });
  }

  function emeraldSkullsSetActionButton(button, visible, enabled) {
    if (!button) return;
    button.classList.toggle("hidden", !visible);
    button.disabled = !enabled || emeraldSkullsPending;
  }

  function emeraldSkullsRenderActions(view) {
    const phase = view.phase;
    emeraldSkullsSetActionButton(emeraldSkullsRollBtn, phase === "await_roll", emeraldSkullsHasAction("roll"));
    emeraldSkullsSetActionButton(emeraldSkullsRerollBtn, phase === "after_roll", emeraldSkullsHasAction("spend_reroll_cube"));
    emeraldSkullsSetActionButton(emeraldSkullsPickNoseBtn, phase === "after_roll", emeraldSkullsHasAction("pick_nose"));
    emeraldSkullsSetActionButton(emeraldSkullsBustBtn, phase === "after_roll" && emeraldSkullsHasAction("accept_bust"), emeraldSkullsHasAction("accept_bust"));
    emeraldSkullsSetActionButton(emeraldSkullsContinueBtn, phase === "post_place", emeraldSkullsHasAction("continue_roll"));
    emeraldSkullsSetActionButton(emeraldSkullsChickenBtn, phase === "post_place", emeraldSkullsHasAction("chicken_out"));
    if (emeraldSkullsActionDock) {
      const anyVisible = [emeraldSkullsRollBtn, emeraldSkullsRerollBtn, emeraldSkullsPickNoseBtn, emeraldSkullsBustBtn, emeraldSkullsContinueBtn, emeraldSkullsChickenBtn]
        .some((button) => button && !button.classList.contains("hidden"));
      emeraldSkullsActionDock.classList.toggle("hidden", !anyVisible);
    }
  }

  function emeraldSkullsRenderPayout(view) {
    if (!emeraldSkullsPayoutChoice || !emeraldSkullsPayoutOptions) return;
    const visible = view.phase === "choose_payout";
    emeraldSkullsPayoutChoice.classList.toggle("hidden", !visible);
    emeraldSkullsPayoutOptions.innerHTML = "";
    if (!visible) return;
    (view.payout_options || []).forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emerald-skulls-payout-button";
      button.dataset.emeraldSkullsExplain = "payout";
      button.disabled = !emeraldSkullsHasAction("choose_payout") || emeraldSkullsPending;
      const title = document.createElement("strong");
      title.textContent = option.label;
      const reward = document.createElement("span");
      const parts = [];
      if (Number(option.gears || 0)) parts.push(`${option.gears} ⚙️`);
      if (Number(option.reroll_cubes || 0)) parts.push(`${option.reroll_cubes} 🟩`);
      reward.textContent = parts.join(" + ") || "No reward";
      emeraldSkullsSetTip(button, `${option.label}: ${option.gears || 0} gears (⚙️), ${option.reroll_cubes || 0} reroll cubes (🟩). Choose one payout.`);
      button.append(title, reward);
      button.addEventListener("click", () => emeraldSkullsDispatch({ type: "choose_payout", option_id: option.option_id }));
      emeraldSkullsPayoutOptions.appendChild(button);
    });
  }

  function emeraldSkullsRenderResult(view) {
    if (!emeraldSkullsResult) return;
    const summary = view.turn_result;
    const visible = Boolean(summary) && (view.phase === "turn_result" || view.game_over);
    emeraldSkullsResult.classList.toggle("hidden", !visible);
    if (!visible) return;
    const winners = (view.winner_ids || []).map((playerId) => emeraldSkullsPlayerName(view, playerId));
    if (emeraldSkullsResultEyebrow) emeraldSkullsResultEyebrow.textContent = view.game_over ? "The pot is empty" : "Turn review";
    if (emeraldSkullsResultTitle) {
      emeraldSkullsResultTitle.textContent = view.game_over
        ? winners.length ? `${winners.join(" & ")} ${winners.length === 1 ? "Wins" : "Win"}` : "Game Over"
        : emeraldSkullsResultText(summary.result);
    }
    if (emeraldSkullsReviewProgress) {
      emeraldSkullsReviewProgress.textContent = view.game_over
        ? "Final standings"
        : `${view.review_progress.done} / ${view.review_progress.total} ready`;
    }
    if (emeraldSkullsResultBody) {
      emeraldSkullsResultBody.innerHTML = "";
      const outcome = document.createElement("article");
      outcome.className = "emerald-skulls-result-item is-tumbler";
      const outcomeTitle = document.createElement("strong");
      outcomeTitle.textContent = `${emeraldSkullsPlayerName(view, summary.tumbler_id)} · ${emeraldSkullsResultText(summary.result)}`;
      const outcomePay = document.createElement("span");
      const tumblerParts = [`${summary.tumbler_gears_paid}/${summary.tumbler_gears_due} ⚙️`];
      if (Number(summary.tumbler_reroll_cubes || 0)) tumblerParts.push(`${summary.tumbler_reroll_cubes} 🟩`);
      outcomePay.textContent = `${summary.payout_label} · ${tumblerParts.join(" + ")}`;
      outcome.append(outcomeTitle, outcomePay);
      emeraldSkullsResultBody.appendChild(outcome);
      (summary.bet_awards || []).forEach((award) => {
        const item = document.createElement("article");
        item.className = "emerald-skulls-result-item";
        const title = document.createElement("strong");
        const bet = (view.betting_options || []).find((option) => option.bet_id === award.bet_id);
        title.textContent = `${emeraldSkullsPlayerName(view, award.player_id)} · ${bet ? bet.name : award.bet_id}`;
        const reward = document.createElement("span");
        reward.textContent = `${award.paid}/${award.due} ⚙️ · stack #${award.position}`;
        item.append(title, reward);
        emeraldSkullsResultBody.appendChild(item);
      });
      if (!(summary.bet_awards || []).length) {
        const noBets = document.createElement("p");
        noBets.className = "emerald-skulls-no-awards";
        noBets.textContent = "No gambler bets paid this turn.";
        emeraldSkullsResultBody.appendChild(noBets);
      }
      if (summary.supply_exhausted) {
        const exhausted = document.createElement("p");
        exhausted.className = "emerald-skulls-pot-empty";
        exhausted.textContent = "⚙️ The pot ran dry. Remaining payouts were cancelled and the game ended immediately.";
        emeraldSkullsResultBody.appendChild(exhausted);
      }
    }
    if (emeraldSkullsReadyList) {
      emeraldSkullsReadyList.innerHTML = "";
      (view.players || []).forEach((player) => {
        const ready = view.game_over ? player.rematch_ready : player.ready;
        const badge = document.createElement("span");
        badge.className = "emerald-skulls-ready-badge";
        badge.classList.toggle("is-ready", ready);
        badge.textContent = `${ready ? "✓" : "○"} ${player.name || player.player_id}`;
        emeraldSkullsReadyList.appendChild(badge);
      });
    }
    if (emeraldSkullsNextBtn) {
      emeraldSkullsNextBtn.classList.toggle("hidden", view.game_over);
      emeraldSkullsNextBtn.textContent = (view.review_ready || []).includes(view.you) ? "Ready ✓" : "Next Turn";
      emeraldSkullsNextBtn.disabled = !emeraldSkullsHasAction("next_turn") || emeraldSkullsPending;
    }
    if (emeraldSkullsPlayAgainBtn) {
      emeraldSkullsPlayAgainBtn.classList.toggle("hidden", !view.game_over);
      emeraldSkullsPlayAgainBtn.textContent = (view.rematch_ready || []).includes(view.you) ? "Rematch Ready ✓" : "Play Again";
      emeraldSkullsPlayAgainBtn.disabled = !emeraldSkullsHasAction("play_again") || emeraldSkullsPending;
    }
  }

  function emeraldSkullsRenderLog(view) {
    if (!emeraldSkullsLog) return;
    emeraldSkullsLog.innerHTML = "";
    const activity = [...(view.activity || [])].reverse();
    if (!activity.length) {
      emeraldSkullsLog.textContent = "No actions yet.";
      return;
    }
    activity.forEach((item) => {
      const row = document.createElement("div");
      row.className = "emerald-skulls-log-row";
      const sequence = document.createElement("span");
      sequence.textContent = `#${item.sequence}`;
      const message = document.createElement("p");
      message.textContent = item.message || String(item.type || "Game event").replaceAll("_", " ");
      row.append(sequence, message);
      emeraldSkullsLog.appendChild(row);
    });
    const latest = activity[0];
    if (emeraldSkullsLiveRegion && Number(latest.sequence || 0) > emeraldSkullsLastAnnounced) {
      emeraldSkullsLastAnnounced = Number(latest.sequence || 0);
      emeraldSkullsLiveRegion.textContent = latest.message || "Game state updated.";
    }
  }

  function emeraldSkullsRenderStatus(view) {
    if (!emeraldSkullsStatus) return;
    const activeName = emeraldSkullsPlayerName(view, view.active_player_id);
    const youAreActive = view.you === view.active_player_id;
    let text = `${EMERALD_SKULLS_PHASES[view.phase] || view.phase}. `;
    if (view.phase === "buy_dice") text += youAreActive ? "Choose your dice pool." : `${activeName} is choosing a dice pool.`;
    else if (view.phase === "await_roll") text += youAreActive ? "Bets are open — give gamblers a moment, then roll." : emeraldSkullsHasAction("place_bet") ? "Place up to two bets before the dice roll." : `Waiting for ${activeName} to roll.`;
    else if (view.phase === "after_roll") text += youAreActive ? "Select matching dice for one level, or use a reroll action." : `${activeName} is studying the roll.`;
    else if (view.phase === "post_place") text += youAreActive ? "Bank the current board or press your luck." : `${activeName} must stop or roll again.`;
    else if (view.phase === "choose_payout") text += youAreActive ? "A jackpot is available — choose one payout." : `${activeName} is choosing a payout.`;
    else if (view.phase === "turn_result") text += emeraldSkullsHasAction("next_turn") ? "Review the final board, then confirm Next Turn." : "Waiting for the table to finish reviewing.";
    else if (view.game_over) text += "The pot is empty. Final scores are locked.";
    emeraldSkullsStatus.textContent = text;
  }

  function emeraldSkullsRenderInteractive(view) {
    emeraldSkullsRenderBoard(view);
    emeraldSkullsRenderDice(view);
    emeraldSkullsRenderBuy(view);
    emeraldSkullsRenderActions(view);
    emeraldSkullsRenderBets(view);
    emeraldSkullsRenderPayout(view);
    emeraldSkullsRenderResult(view);
    emeraldSkullsRefreshExplainTargets();
  }

  function emeraldSkullsRenderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    emeraldSkullsView = view;
    const mobileContext = `${view.game_index}:${view.turn_number}:${view.active_player_id}:${view.result ? "review" : "play"}`;
    if (mobileContext !== emeraldSkullsMobileContext) {
      emeraldSkullsMobileContext = mobileContext;
      emeraldSkullsSetMobileTab(view.you === view.active_player_id || view.result ? "skull" : "bets");
    }
    emeraldSkullsPending = false;
    if (emeraldSkullsPendingTimer) window.clearTimeout(emeraldSkullsPendingTimer);
    emeraldSkullsPendingTimer = null;
    const rolledIds = new Set((view.dice || []).filter((die) => die.zone === "rolled").map((die) => die.die_id));
    [...emeraldSkullsSelectedDice].forEach((dieId) => {
      if (!rolledIds.has(dieId)) emeraldSkullsSelectedDice.delete(dieId);
    });
    if (typeof currentGameType !== "undefined" && currentGameType !== "emerald_skulls") {
      currentGameType = "emerald_skulls";
      setGamePanelVisibility("emerald_skulls");
    }
    if (emeraldSkullsTurnLabel) emeraldSkullsTurnLabel.textContent = `${view.turn_number} · ${EMERALD_SKULLS_PHASES[view.phase] || view.phase}`;
    if (emeraldSkullsTumblerLabel) emeraldSkullsTumblerLabel.textContent = emeraldSkullsPlayerName(view, view.active_player_id);
    emeraldSkullsSetTip(emeraldSkullsTumblerLabel, `${emeraldSkullsPlayerName(view, view.active_player_id)} · Tumbler: buys and rolls the dice this turn.`);
    if (emeraldSkullsPotLabel) emeraldSkullsPotLabel.textContent = String(Number(view.gear_supply || 0));
    emeraldSkullsRenderStatus(view);
    emeraldSkullsRenderPlayers(view);
    emeraldSkullsRenderInteractive(view);
    emeraldSkullsRenderLog(view);
  }

  function emeraldSkullsSetExplainMode(enabled) {
    emeraldSkullsHideTip();
    emeraldSkullsExplainMode = Boolean(enabled);
    document.body.classList.toggle("emerald-skulls-explain-mode", emeraldSkullsExplainMode);
    if (emeraldSkullsExplainBtn) emeraldSkullsExplainBtn.setAttribute("aria-pressed", emeraldSkullsExplainMode ? "true" : "false");
    document.querySelectorAll("[data-emerald-skulls-explain]").forEach((element) => {
      element.classList.toggle("has-explanation", emeraldSkullsExplainMode);
    });
  }

  function emeraldSkullsRefreshExplainTargets() {
    if (!emeraldSkullsExplainMode) return;
    document.querySelectorAll("[data-emerald-skulls-explain]").forEach((element) => element.classList.add("has-explanation"));
  }

  function emeraldSkullsShowExplanation(target) {
    if (!target || !emeraldSkullsExplainContent) return;
    const key = target.dataset.emeraldSkullsExplain;
    const fallback = EMERALD_SKULLS_EXPLANATIONS[key];
    const titleText = target.dataset.emeraldSkullsExplainTitle || (fallback && fallback.title);
    const bodyText = target.dataset.emeraldSkullsExplainBody || (fallback && fallback.body);
    if (!titleText || !bodyText) return;
    emeraldSkullsExplainContent.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = titleText;
    const body = document.createElement("p");
    body.textContent = bodyText;
    emeraldSkullsExplainContent.append(title, body);
    emeraldSkullsSetModal(emeraldSkullsExplainModal, true);
  }

  function emeraldSkullsFindDisabledExplainTarget(x, y) {
    const targets = document.querySelectorAll("button[data-emerald-skulls-explain]:disabled");
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return target;
    }
    return null;
  }

  function emeraldSkullsClearState() {
    emeraldSkullsView = null;
    emeraldSkullsSelectedDice.clear();
    emeraldSkullsPending = false;
    emeraldSkullsLastAnnounced = 0;
    emeraldSkullsMobileContext = "";
    emeraldSkullsSuppressClick = false;
    if (emeraldSkullsPendingTimer) window.clearTimeout(emeraldSkullsPendingTimer);
    emeraldSkullsPendingTimer = null;
    emeraldSkullsSetExplainMode(false);
    emeraldSkullsSetModal(emeraldSkullsHelpModal, false);
    emeraldSkullsSetModal(emeraldSkullsExplainModal, false);
    if (emeraldSkullsStatus) emeraldSkullsStatus.textContent = "Waiting for game state…";
  }

  function emeraldSkullsShowHeaderActions(show) {
    if (emeraldSkullsHeaderActions) emeraldSkullsHeaderActions.style.display = show ? "flex" : "none";
    if (!show) {
      emeraldSkullsMobileContext = "";
      emeraldSkullsSelectedDice.clear();
      emeraldSkullsSetExplainMode(false);
      emeraldSkullsSetModal(emeraldSkullsHelpModal, false);
      emeraldSkullsSetModal(emeraldSkullsExplainModal, false);
    }
  }

  if (emeraldSkullsHelpContent) emeraldSkullsHelpContent.innerHTML = EMERALD_SKULLS_HELP_HTML;
  if (emeraldSkullsPanel) {
    emeraldSkullsPanel.querySelectorAll("[data-emerald-skulls-tab]").forEach((button) => {
      button.addEventListener("click", () => emeraldSkullsSetMobileTab(button.dataset.emeraldSkullsTab));
    });
    emeraldSkullsPanel.querySelectorAll("button[data-emerald-skulls-explain]").forEach((button) => {
      const explanation = EMERALD_SKULLS_EXPLANATIONS[button.dataset.emeraldSkullsExplain];
      if (explanation) emeraldSkullsSetTip(button, explanation.body);
    });
    emeraldSkullsPanel.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target.closest("[data-emerald-skulls-tip]");
      if (target) emeraldSkullsShowTip(target);
    });
    emeraldSkullsPanel.addEventListener("pointerout", (event) => {
      if (event.pointerType === "mouse" && !event.target.contains(event.relatedTarget)) emeraldSkullsHideTip();
    });
    emeraldSkullsPanel.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      const target = event.target.closest("[data-emerald-skulls-tip]");
      if (target) emeraldSkullsShowTip(target, true);
      else emeraldSkullsHideTip();
    });
    emeraldSkullsPanel.addEventListener("focusin", (event) => {
      // Touch-triggered focus must not cancel the three-second dismiss timer.
      if (!emeraldSkullsTipTimer) emeraldSkullsShowTip(event.target.closest("[data-emerald-skulls-tip]"));
    });
    emeraldSkullsPanel.addEventListener("focusout", () => {
      if (!emeraldSkullsTipTimer) emeraldSkullsHideTip();
    });
  }
  if (emeraldSkullsRollBtn) emeraldSkullsRollBtn.addEventListener("click", () => emeraldSkullsHasAction("roll") && emeraldSkullsDispatch({ type: "roll" }));
  if (emeraldSkullsRerollBtn) emeraldSkullsRerollBtn.addEventListener("click", () => emeraldSkullsHasAction("spend_reroll_cube") && emeraldSkullsDispatch({ type: "spend_reroll_cube" }));
  if (emeraldSkullsPickNoseBtn) {
    emeraldSkullsPickNoseBtn.addEventListener("click", () => {
      if (!emeraldSkullsHasAction("pick_nose") || !emeraldSkullsView) return;
      const die = (emeraldSkullsView.dice || []).find((item) => item.zone === "board" && Number(item.level) === 3 && Number(item.face) === 3);
      if (die) emeraldSkullsDispatch({ type: "pick_nose", die_id: die.die_id });
    });
  }
  if (emeraldSkullsContinueBtn) emeraldSkullsContinueBtn.addEventListener("click", () => emeraldSkullsHasAction("continue_roll") && emeraldSkullsDispatch({ type: "continue_roll" }));
  if (emeraldSkullsChickenBtn) emeraldSkullsChickenBtn.addEventListener("click", () => emeraldSkullsHasAction("chicken_out") && emeraldSkullsDispatch({ type: "chicken_out" }));
  if (emeraldSkullsBustBtn) emeraldSkullsBustBtn.addEventListener("click", () => emeraldSkullsHasAction("accept_bust") && emeraldSkullsDispatch({ type: "accept_bust" }));
  if (emeraldSkullsNextBtn) emeraldSkullsNextBtn.addEventListener("click", () => emeraldSkullsHasAction("next_turn") && emeraldSkullsDispatch({ type: "next_turn" }));
  if (emeraldSkullsPlayAgainBtn) emeraldSkullsPlayAgainBtn.addEventListener("click", () => emeraldSkullsHasAction("play_again") && emeraldSkullsDispatch({ type: "play_again" }));
  if (emeraldSkullsBoard) {
    emeraldSkullsBoard.querySelectorAll(".emerald-skulls-level").forEach((button) => {
      button.addEventListener("click", () => {
        const level = Number(button.dataset.level);
        if (button.disabled || !emeraldSkullsHasAction("place_dice") || !emeraldSkullsSelectedDice.size) return;
        const dieIds = [...emeraldSkullsSelectedDice];
        emeraldSkullsSelectedDice.clear();
        emeraldSkullsDispatch({ type: "place_dice", level, die_ids: dieIds });
      });
    });
  }
  if (emeraldSkullsHelpBtn) emeraldSkullsHelpBtn.addEventListener("click", () => emeraldSkullsSetModal(emeraldSkullsHelpModal, true));
  if (emeraldSkullsExplainBtn) emeraldSkullsExplainBtn.addEventListener("click", () => emeraldSkullsSetExplainMode(!emeraldSkullsExplainMode));
  if (emeraldSkullsHelpCloseBtn) emeraldSkullsHelpCloseBtn.addEventListener("click", () => emeraldSkullsSetModal(emeraldSkullsHelpModal, false, emeraldSkullsHelpBtn));
  if (emeraldSkullsExplainCloseBtn) emeraldSkullsExplainCloseBtn.addEventListener("click", () => emeraldSkullsSetModal(emeraldSkullsExplainModal, false));

  [emeraldSkullsHelpModal, emeraldSkullsExplainModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) emeraldSkullsSetModal(modal, false, modal === emeraldSkullsHelpModal ? emeraldSkullsHelpBtn : null);
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      if (emeraldSkullsSuppressClick) {
        emeraldSkullsSuppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!emeraldSkullsExplainMode || typeof currentGameType === "undefined" || currentGameType !== "emerald_skulls") return;
      const button = event.target.closest("button");
      if ([emeraldSkullsHelpBtn, emeraldSkullsExplainBtn, emeraldSkullsHelpCloseBtn, emeraldSkullsExplainCloseBtn].includes(button)) return;
      const target = button ? (button.matches("[data-emerald-skulls-explain]") ? button : null) : event.target.closest("[data-emerald-skulls-explain]");
      if (!button && (!target || !emeraldSkullsPanel || !emeraldSkullsPanel.contains(target))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (target && target.dataset.emeraldSkullsExplain) {
        emeraldSkullsShowExplanation(target);
        emeraldSkullsSetExplainMode(false);
      }
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      emeraldSkullsSuppressClick = false;
      if (!emeraldSkullsExplainMode || typeof currentGameType === "undefined" || currentGameType !== "emerald_skulls") return;
      const target = emeraldSkullsFindDisabledExplainTarget(event.clientX, event.clientY);
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      emeraldSkullsSuppressClick = true;
      emeraldSkullsShowExplanation(target);
      emeraldSkullsSetExplainMode(false);
    },
    true
  );

  document.addEventListener("pointerdown", (event) => {
    if (
      emeraldSkullsExplainMode ||
      !emeraldSkullsSelectedDice.size ||
      typeof currentGameType === "undefined" ||
      currentGameType !== "emerald_skulls" ||
      !emeraldSkullsPanel ||
      !emeraldSkullsPanel.contains(event.target)
    ) return;
    if (event.target.closest(".emerald-skulls-die, .emerald-skulls-level, .emerald-skulls-action-dock")) return;
    emeraldSkullsSelectedDice.clear();
    if (emeraldSkullsView) emeraldSkullsRenderInteractive(emeraldSkullsView);
  });

  document.addEventListener("keydown", (event) => {
    emeraldSkullsSuppressClick = false;
    const modal = [emeraldSkullsHelpModal, emeraldSkullsExplainModal].find((element) => element && !element.classList.contains("hidden"));
    if (modal && event.key === "Tab") {
      const controls = [...modal.querySelectorAll("button, a[href], [tabindex='0']")].filter((element) => !element.disabled);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (event.key !== "Escape") return;
    emeraldSkullsHideTip();
    if (modal) {
      emeraldSkullsSetModal(modal, false, modal === emeraldSkullsHelpModal ? emeraldSkullsHelpBtn : emeraldSkullsExplainBtn);
      return;
    }
    if (emeraldSkullsExplainMode) emeraldSkullsSetExplainMode(false);
    if (emeraldSkullsSelectedDice.size) {
      emeraldSkullsSelectedDice.clear();
      if (emeraldSkullsView) emeraldSkullsRenderInteractive(emeraldSkullsView);
    }
    if (emeraldSkullsHelpModal && !emeraldSkullsHelpModal.classList.contains("hidden")) emeraldSkullsSetModal(emeraldSkullsHelpModal, false, emeraldSkullsHelpBtn);
    if (emeraldSkullsExplainModal && !emeraldSkullsExplainModal.classList.contains("hidden")) emeraldSkullsSetModal(emeraldSkullsExplainModal, false);
  });

  window.addEventListener("resize", emeraldSkullsHideTip);
  document.addEventListener("scroll", emeraldSkullsHideTip, true);

  window.clearEmeraldSkullsState = emeraldSkullsClearState;
  window.renderEmeraldSkullsGameState = emeraldSkullsRenderGameState;
  window.showEmeraldSkullsHeaderActions = emeraldSkullsShowHeaderActions;
})();
