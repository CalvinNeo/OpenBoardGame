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
