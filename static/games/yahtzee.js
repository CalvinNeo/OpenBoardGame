function isYahtzeeActionAvailable(actionType) {
  if (!currentYahtzeeView || !Array.isArray(currentYahtzeeView.legal_actions)) {
    return false;
  }
  return currentYahtzeeView.legal_actions.includes(actionType);
}

function updateYahtzeeActionButtons() {
  if (!yahtzeeRollBtn) {
    return;
  }
  if (currentGameType !== "yahtzee") {
    yahtzeeRollBtn.classList.remove("action-allowed");
    yahtzeeRollBtn.disabled = true;
    return;
  }
  const allowed = isYahtzeeActionAvailable("roll");
  if (allowed) {
    yahtzeeRollBtn.classList.add("action-allowed");
  } else {
    yahtzeeRollBtn.classList.remove("action-allowed");
  }
  yahtzeeRollBtn.disabled = !allowed;
}
