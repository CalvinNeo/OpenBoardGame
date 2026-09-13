const phaseLabel = document.getElementById("phaseLabel");
const roundLabel = document.getElementById("roundLabel");
const turnLabel = document.getElementById("turnLabel");
const deckCount = document.getElementById("deckCount");
const discardTop = document.getElementById("discardTop");
const lastDrawn = document.getElementById("lastDrawn");
const caboBy = document.getElementById("caboBy");
const caboLeft = document.getElementById("caboLeft");
const pendingChoice = document.getElementById("pendingChoice");
const caboChoiceHint = document.getElementById("caboChoiceHint");

const handSlots = document.getElementById("handSlots");
const selectedSlotsLabel = document.getElementById("selectedSlots");
const targetSelection = document.getElementById("targetSelection");
const targetList = document.getElementById("targetList");
const clearTargetBtn = document.getElementById("clearTarget");
const gamePlayers = document.getElementById("gamePlayers");

const actionButtons = {
  initial_peek: document.getElementById("peekBtn"),
  draw_deck: document.getElementById("drawDeckBtn"),
  draw_discard: discardTop,
  replace_or_match: document.getElementById("replaceBtn"),
  discard_drawn: document.getElementById("discardDrawnBtn"),
  call_cabo: document.getElementById("callCaboBtn"),
  use_choice_action: document.getElementById("choiceBtn"),
  next_round: document.getElementById("nextRoundBtn"),
};

const clearSelectionBtn = document.getElementById("clearSelection");

let currentCaboView = null;
let selectedSlots = [];
let selectedTarget = null;

const caboChoiceByValue = Object.freeze({
  7: "peek",
  8: "peek",
  9: "spy",
  10: "spy",
  11: "swap",
  12: "swap",
});

function getCaboActiveChoiceType(view = currentCaboView) {
  if (!view) {
    return null;
  }
  const canUseChoice =
    Array.isArray(view.legal_actions) && view.legal_actions.includes("use_choice_action");
  if (!canUseChoice) {
    return null;
  }
  if (view.pending_choice && view.pending_choice.type) {
    return view.pending_choice.type;
  }
  if (view.phase === "drawn") {
    return caboChoiceByValue[view.last_drawn] || null;
  }
  return null;
}

function updateCaboChoicePrompt() {
  const choiceType = getCaboActiveChoiceType();
  const buttonLabels = {
    peek: "Peek at Selected Card",
    spy: "Spy on Selected Card",
    swap: "Swap Selected Cards",
  };
  actionButtons.use_choice_action.textContent = buttonLabels[choiceType] || "Use Choice";

  if (!caboChoiceHint) {
    return;
  }
  const discardNote =
    currentCaboView && currentCaboView.phase === "drawn"
      ? "The drawn card will be discarded automatically."
      : "The choice card has already been discarded.";
  const promptByType = {
    peek: `Peek is ready: select one of your cards, then use Peek. ${discardNote}`,
    spy: `Spy is ready: select one highlighted opponent card, then use Spy. ${discardNote}`,
    swap: `Swap is ready: select one of your cards and one highlighted opponent card, then use Swap. ${discardNote}`,
  };
  const prompt = promptByType[choiceType] || "";
  caboChoiceHint.textContent = prompt;
  caboChoiceHint.classList.toggle("hidden", !prompt);
}

function getInitialPeekInactiveReason() {
  if (!currentCaboView) {
    return "Initial Peek inactive: no game view";
  }
  if (!Array.isArray(currentCaboView.legal_actions)) {
    return "Initial Peek inactive: legal actions unavailable";
  }
  if (!currentCaboView.legal_actions.includes("initial_peek")) {
    if (currentCaboView.phase !== "initial_peek") {
      return `Initial Peek inactive: phase is ${currentCaboView.phase}`;
    }
    const self = Array.isArray(currentCaboView.players)
      ? currentCaboView.players.find((p) => p.player_id === currentCaboView.you)
      : null;
    if (self && self.initial_peek_done) {
      return "Initial Peek inactive: already completed";
    }
    return `Initial Peek inactive: legal actions are ${JSON.stringify(currentCaboView.legal_actions)}`;
  }
  if (selectedSlots.length < 2) {
    return `Initial Peek inactive: select 2 slots (current ${selectedSlots.length})`;
  }
  if (selectedSlots.length > 2) {
    return `Initial Peek inactive: select only 2 slots (current ${selectedSlots.length})`;
  }
  return null;
}

function updateSelectedSlots() {
  if (selectedSlotsLabel) {
    selectedSlotsLabel.textContent = selectedSlots.length ? selectedSlots.join(", ") : "-";
  }
}

function updateTargetSelection() {
  if (!targetSelection) {
    return;
  }
  if (!selectedTarget || !currentCaboView) {
    targetSelection.textContent = "-";
    return;
  }
  const player = currentCaboView.players.find((p) => p.player_id === selectedTarget.playerId);
  if (!player) {
    targetSelection.textContent = "-";
    return;
  }
  targetSelection.textContent = `${player.name} #${selectedTarget.slot}`;
}

function clearTargetSelection() {
  selectedTarget = null;
  updateTargetSelection();
  updateActionButtons();
  if (currentCaboView) {
    renderGamePlayers(currentCaboView);
  }
}

function isCaboActionAvailable(actionType) {
  if (!currentCaboView || !Array.isArray(currentCaboView.legal_actions)) {
    return false;
  }
  if (actionType === "replace_or_match") {
    const canReplace = currentCaboView.legal_actions.includes("replace_card");
    const canMatch = currentCaboView.legal_actions.includes("attempt_match");
    if (selectedSlots.length >= 2) {
      return canMatch;
    }
    return selectedSlots.length >= 1 && canReplace;
  }
  if (!currentCaboView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "initial_peek") {
    return !getInitialPeekInactiveReason();
  }
  if (actionType === "draw_discard") {
    return selectedSlots.length >= 1;
  }
  if (actionType === "use_choice_action") {
    const choiceType = getCaboActiveChoiceType();
    if (!choiceType) return false;
    if (choiceType === "peek") {
      return selectedSlots.length >= 1;
    }
    if (choiceType === "spy") {
      return !!selectedTarget;
    }
    if (choiceType === "swap") {
      return !!selectedTarget && selectedSlots.length >= 1;
    }
  }
  return true;
}

function updateActionButtons() {
  updateCaboChoicePrompt();
  if (currentGameType !== "cabo") {
    Object.values(actionButtons).forEach((button) => {
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(actionButtons).forEach(([actionType, button]) => {
    const allowed = isCaboActionAvailable(actionType);
    const inactiveReason = actionType === "initial_peek" ? getInitialPeekInactiveReason() : "";
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    if (actionType === "initial_peek" && currentGameType === "cabo") {
      button.disabled = false;
      button.title = inactiveReason || "";
    } else {
      button.disabled = !allowed;
      button.title = "";
    }
  });
}

function clearSelection() {
  selectedSlots = [];
  updateSelectedSlots();
  document.querySelectorAll(".slot").forEach((el) => {
    el.classList.remove("selected");
  });
  updateActionButtons();
}

function renderHand(view) {
  handSlots.innerHTML = "";
  const you = view.players.find((p) => p.player_id === view.you);
  const activeChoiceType = getCaboActiveChoiceType(view);
  const needsOwnChoiceCard = activeChoiceType === "peek" || activeChoiceType === "swap";
  if (!you) {
    handSlots.textContent = "-";
    return;
  }
  you.hand.forEach((slot, idx) => {
    const div = document.createElement("div");
    div.className = "slot";
    if (slot.empty) div.classList.add("empty");
    if (needsOwnChoiceCard && !slot.empty) {
      div.classList.add("cabo-choice-selectable");
      div.title =
        activeChoiceType === "peek" ? "Select this card to peek" : "Select this card to swap";
    }
    div.dataset.slot = idx;
    let label = "?";
    if (slot.empty) {
      label = "Empty";
    } else if (slot.known) {
      label = String(slot.value);
    }
    div.textContent = `#${idx} ${label}`;
    if (selectedSlots.includes(idx)) div.classList.add("selected");
    div.addEventListener("click", () => {
      if (slot.empty) {
        return;
      }
      if (selectedSlots.includes(idx)) {
        selectedSlots = selectedSlots.filter((s) => s !== idx);
        div.classList.remove("selected");
      } else {
        if (needsOwnChoiceCard && selectedSlots.length >= 1) {
          selectedSlots = [];
          handSlots.querySelectorAll(".slot.selected").forEach((slotElement) => {
            slotElement.classList.remove("selected");
          });
        } else if (
          currentCaboView &&
          currentCaboView.phase === "initial_peek" &&
          selectedSlots.length >= 2
        ) {
          selectedSlots = selectedSlots.slice(-1);
          handSlots.querySelectorAll(".slot.selected").forEach((slotElement) => {
            const slotIndex = Number(slotElement.dataset.slot);
            slotElement.classList.toggle("selected", selectedSlots.includes(slotIndex));
          });
        }
        selectedSlots.push(idx);
        div.classList.add("selected");
      }
      updateSelectedSlots();
      updateActionButtons();
    });
    handSlots.appendChild(div);
  });
}

function renderGamePlayers(view) {
  gamePlayers.innerHTML = "";
  const activeChoiceType = getCaboActiveChoiceType(view);
  const canSelectTarget = activeChoiceType === "spy" || activeChoiceType === "swap";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.current_turn) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name;
    header.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${p.score}`;
    badges.appendChild(score);
    if (p.player_id === view.you) {
      const you = document.createElement("span");
      you.className = "badge";
      you.textContent = "you";
      badges.appendChild(you);
    }
    if (p.is_bot) {
      const bot = document.createElement("span");
      bot.className = "badge";
      bot.textContent = "bot";
      badges.appendChild(bot);
    }
    if (p.player_id === view.current_turn) {
      const turn = document.createElement("span");
      turn.className = "badge highlight";
      turn.textContent = "turn";
      badges.appendChild(turn);
    }
    if (view.phase === "round_end") {
      const ready = document.createElement("span");
      ready.className = "badge";
      ready.textContent = p.round_ready ? "✅ ready" : "⏳ waiting";
      badges.appendChild(ready);
    }
    header.appendChild(badges);

    const handRow = document.createElement("div");
    handRow.className = "player-hand";
    p.hand.forEach((slot, idx) => {
      const slotEl = document.createElement("div");
      slotEl.className = "player-slot";
      const isTargetPlayer = p.player_id !== view.you;
      const isSelectableTarget = canSelectTarget && isTargetPlayer && !slot.empty;
      if (slot.empty) {
        slotEl.classList.add("empty");
      }
      const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
      slotEl.textContent = `#${idx} ${label}`;
      if (
        selectedTarget &&
        selectedTarget.playerId === p.player_id &&
        selectedTarget.slot === idx
      ) {
        slotEl.classList.add("target-selected");
      }
      if (isSelectableTarget) {
        slotEl.classList.add("target-selectable");
        slotEl.title =
          activeChoiceType === "spy" ? "Select this card to spy" : "Select this card to swap";
        slotEl.addEventListener("click", () => {
          const isSameTarget =
            selectedTarget &&
            selectedTarget.playerId === p.player_id &&
            selectedTarget.slot === idx;
          selectedTarget = isSameTarget ? null : { playerId: p.player_id, slot: idx };
          updateTargetSelection();
          updateActionButtons();
          renderGamePlayers(view);
        });
      }
      handRow.appendChild(slotEl);
    });

    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = `cards ${p.hand_count}`;

    card.appendChild(header);
    card.appendChild(handRow);
    card.appendChild(meta);
    gamePlayers.appendChild(card);
  });
}

function renderTargets(view) {
  if (!targetList) {
    updateTargetSelection();
    return;
  }
  targetList.innerHTML = "";
  view.players
    .filter((p) => p.player_id !== view.you)
    .forEach((p) => {
      const wrapper = document.createElement("div");
      wrapper.className = "target-player";
      const title = document.createElement("div");
      title.textContent = p.name;
      wrapper.appendChild(title);

      const slotsRow = document.createElement("div");
      slotsRow.className = "target-slots";
      p.hand.forEach((slot, idx) => {
        const slotEl = document.createElement("div");
        slotEl.className = "target-slot";
        const label = slot.empty ? "Empty" : slot.known ? slot.value : "?";
        slotEl.textContent = `#${idx} ${label}`;
        if (
          selectedTarget &&
          selectedTarget.playerId === p.player_id &&
          selectedTarget.slot === idx
        ) {
          slotEl.classList.add("selected");
        }
        slotEl.addEventListener("click", () => {
          if (slot.empty) {
            log("Target slot is empty");
            return;
          }
          selectedTarget = { playerId: p.player_id, slot: idx };
          updateTargetSelection();
          updateActionButtons();
          renderTargets(view);
        });
        slotsRow.appendChild(slotEl);
      });
      wrapper.appendChild(slotsRow);
      targetList.appendChild(wrapper);
    });
  updateTargetSelection();
}

function clearCaboState() {
  currentCaboView = null;
  selectedSlots = [];
  selectedTarget = null;
  phaseLabel.textContent = "-";
  roundLabel.textContent = "-";
  turnLabel.textContent = "-";
  deckCount.textContent = "-";
  discardTop.textContent = "-";
  lastDrawn.textContent = "-";
  caboBy.textContent = "-";
  caboLeft.textContent = "-";
  pendingChoice.textContent = "-";
  if (caboChoiceHint) {
    caboChoiceHint.textContent = "";
    caboChoiceHint.classList.add("hidden");
  }
  handSlots.innerHTML = "";
  if (selectedSlotsLabel) {
    selectedSlotsLabel.textContent = "-";
  }
  if (targetSelection) {
    targetSelection.textContent = "-";
  }
  if (targetList) {
    targetList.innerHTML = "";
  }
  gamePlayers.innerHTML = "";
  updateActionButtons();
}

function renderCaboGameState(data) {
  const view = data.view;
  currentCaboView = view;
  if (currentGameType !== "cabo") {
    currentGameType = "cabo";
    setGamePanelVisibility("cabo");
  }
  const activeChoiceType = getCaboActiveChoiceType(view);
  const needsTarget = activeChoiceType === "spy" || activeChoiceType === "swap";
  if (!needsTarget) {
    selectedTarget = null;
  } else if (selectedTarget) {
    const targetPlayer = view.players.find((p) => p.player_id === selectedTarget.playerId);
    const targetSlot =
      targetPlayer && Array.isArray(targetPlayer.hand)
        ? targetPlayer.hand[selectedTarget.slot]
        : null;
    if (!targetPlayer || !targetSlot || targetSlot.empty) {
      selectedTarget = null;
    }
  }

  phaseLabel.textContent = view.phase;
  roundLabel.textContent = view.round;
  const currentPlayer = view.players.find((p) => p.player_id === view.current_turn);
  turnLabel.textContent = currentPlayer ? currentPlayer.name : view.current_turn;
  deckCount.textContent = view.deck_count;
  discardTop.textContent = view.discard_top === null ? "-" : view.discard_top;
  if (view.last_drawn === null || view.last_drawn === undefined) {
    lastDrawn.textContent = "-";
  } else {
    const choice = caboChoiceByValue[view.last_drawn];
    lastDrawn.textContent = choice ? `${view.last_drawn} (${choice})` : String(view.last_drawn);
  }
  const caboCaller = view.players.find((p) => p.player_id === view.cabo_called_by);
  caboBy.textContent = caboCaller ? caboCaller.name : view.cabo_called_by || "-";
  caboLeft.textContent = view.cabo_turns_left || "-";
  pendingChoice.textContent = view.pending_choice ? view.pending_choice.type : "-";

  renderHand(view);
  renderGamePlayers(view);

  logGameEvents(data);

  if (view.last_round_summary) {
    const summary = view.last_round_summary;
    log(`Round summary: scores ${JSON.stringify(summary.round_scores)}`);
  }

  updateActionButtons();
}

if (clearSelectionBtn) {
  clearSelectionBtn.addEventListener("click", () => {
    clearSelection();
  });
}

if (clearTargetBtn) {
  clearTargetBtn.addEventListener("click", () => {
    clearTargetSelection();
  });
}

if (actionButtons.initial_peek) {
  actionButtons.initial_peek.addEventListener("click", () => {
    const reason = getInitialPeekInactiveReason();
    if (reason) {
      log(reason);
      return;
    }
    sendAction({ type: "initial_peek", slots: selectedSlots.slice(0, 2) });
    clearSelection();
  });
}

if (actionButtons.draw_deck) {
  actionButtons.draw_deck.addEventListener("click", () => {
    sendAction({ type: "draw_deck" });
  });
}

if (discardTop) {
  discardTop.addEventListener("click", () => {
    if (!selectedSlots.length) {
      log("Select a slot to replace from discard");
      return;
    }
    sendAction({ type: "draw_discard", slot: selectedSlots[0] });
    clearSelection();
  });
}

if (actionButtons.replace_or_match) {
  actionButtons.replace_or_match.addEventListener("click", () => {
    if (!selectedSlots.length) {
      log("Select 1 slot to replace or 2-4 slots to match");
      return;
    }
    if (selectedSlots.length >= 2) {
      sendAction({ type: "attempt_match", slots: selectedSlots.slice(0, 4) });
    } else {
      sendAction({ type: "replace_card", slot: selectedSlots[0] });
    }
    clearSelection();
  });
}

if (actionButtons.discard_drawn) {
  actionButtons.discard_drawn.addEventListener("click", () => {
    sendAction({ type: "discard_drawn" });
  });
}

if (actionButtons.call_cabo) {
  actionButtons.call_cabo.addEventListener("click", () => {
    sendAction({ type: "call_cabo" });
  });
}

if (actionButtons.next_round) {
  actionButtons.next_round.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}

if (actionButtons.use_choice_action) {
  actionButtons.use_choice_action.addEventListener("click", () => {
    const choiceType = getCaboActiveChoiceType();
    if (!choiceType) {
      log("No choice action is available");
      return;
    }
    if (choiceType === "peek") {
      if (!selectedSlots.length) {
        log("Select one of your slots to peek");
        return;
      }
      const slot = selectedSlots[0];
      sendAction({
        type: "use_choice_action",
        choice_type: "peek",
        target: { slot },
      });
    } else if (choiceType === "spy") {
      if (!selectedTarget) {
        log("Select a target slot to spy");
        return;
      }
      sendAction({
        type: "use_choice_action",
        choice_type: "spy",
        target: { player_id: selectedTarget.playerId, slot: selectedTarget.slot },
      });
    } else if (choiceType === "swap") {
      if (!selectedTarget || !selectedSlots.length) {
        log("Select one of your slots and a target slot to swap");
        return;
      }
      const self = selectedSlots[0];
      sendAction({
        type: "use_choice_action",
        choice_type: "swap",
        target: {
          player_id: selectedTarget.playerId,
          slot: selectedTarget.slot,
          self_slot: self,
        },
      });
    }
    clearSelection();
    clearTargetSelection();
  });
}
