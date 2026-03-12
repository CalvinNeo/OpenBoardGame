function getTexasBetAmount() {
  if (!texasBetInput) {
    return null;
  }
  const amount = Number.parseInt(texasBetInput.value, 10);
  if (!Number.isInteger(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

function isTexasHoldemActionAvailable(actionType) {
  if (!currentTexasHoldemView || !Array.isArray(currentTexasHoldemView.legal_actions)) {
    return false;
  }
  if (!currentTexasHoldemView.legal_actions.includes(actionType)) {
    return false;
  }
  if (actionType === "bet" || actionType === "raise") {
    const amount = getTexasBetAmount();
    if (!amount) {
      return false;
    }
    const info = currentTexasHoldemView.action_info || {};
    const maxRaiseTo = Number.isInteger(info.max_raise_to) ? info.max_raise_to : null;
    const minBet = Number.isInteger(info.min_bet) ? info.min_bet : null;
    const minRaiseTo = Number.isInteger(info.min_raise_to) ? info.min_raise_to : null;
    if (maxRaiseTo !== null && amount > maxRaiseTo) {
      return false;
    }
    if (actionType === "bet" && minBet !== null && amount < minBet && amount !== maxRaiseTo) {
      return false;
    }
    if (actionType === "raise" && minRaiseTo !== null && amount < minRaiseTo && amount !== maxRaiseTo) {
      return false;
    }
  }
  return true;
}

function updateTexasHoldemActionButtons() {
  const actionButtons = {
    fold: texasFoldBtn,
    check: texasCheckBtn,
    call: texasCallBtn,
    bet: texasBetBtn,
    raise: texasRaiseBtn,
    all_in: texasAllInBtn,
    next_hand: texasNextHandBtn,
    rebuy: texasRebuyBtn,
  };
  if (currentGameType !== "texas_holdem") {
    Object.values(actionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(actionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isTexasHoldemActionAvailable(actionType);
    button.disabled = !allowed;
    button.classList.toggle("action-allowed", allowed);
  });
  if (texasCallBtn && currentTexasHoldemView) {
    const toCall = currentTexasHoldemView.action_info?.to_call;
    texasCallBtn.textContent = Number.isInteger(toCall) && toCall > 0 ? `Call ${toCall}` : "Call";
  }
}
