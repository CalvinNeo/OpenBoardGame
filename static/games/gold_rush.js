function isGoldRushActionAvailable(actionType) {
  if (!currentGoldRushView || !Array.isArray(currentGoldRushView.legal_actions)) {
    return false;
  }
  if (!currentGoldRushView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "play_card") {
    const hand = getGoldRushHand(currentGoldRushView);
    return (
      Number.isInteger(goldRushSelectedHandIndex) &&
      goldRushSelectedHandIndex >= 0 &&
      goldRushSelectedHandIndex < hand.length
    );
  }
  return true;
}

function updateGoldRushActionButtons() {
  const buttons = [
    { type: "play_card", el: goldRushPlayCardBtn },
    { type: "draw_card", el: goldRushDrawCardBtn },
    { type: "invest", el: goldRushInvestYesBtn },
    { type: "invest", el: goldRushInvestNoBtn },
    { type: "play_again", el: goldRushPlayAgainBtn },
  ];
  if (currentGameType !== "gold_rush") {
    buttons.forEach(({ el }) => {
      if (!el) {
        return;
      }
      el.classList.remove("action-allowed");
      el.disabled = true;
    });
    return;
  }
  buttons.forEach(({ type, el }) => {
    if (!el) {
      return;
    }
    const allowed = isGoldRushActionAvailable(type);
    if (allowed) {
      el.classList.add("action-allowed");
    } else {
      el.classList.remove("action-allowed");
    }
    el.disabled = !allowed;
  });
}
