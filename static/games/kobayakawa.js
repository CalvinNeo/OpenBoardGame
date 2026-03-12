function isKobayakawaActionAvailable(actionType) {
  if (!currentKobayakawaView || !Array.isArray(currentKobayakawaView.legal_actions)) {
    return false;
  }
  return currentKobayakawaView.legal_actions.includes(actionType);
}

function updateKobayakawaActionButtons() {
  if (currentGameType !== "kobayakawa") {
    Object.values(kobayakawaActionButtons).forEach((button) => {
      if (!button) {
        return;
      }
      button.classList.remove("action-allowed");
      button.disabled = true;
    });
    return;
  }
  Object.entries(kobayakawaActionButtons).forEach(([actionType, button]) => {
    if (!button) {
      return;
    }
    const allowed = isKobayakawaActionAvailable(actionType);
    if (allowed) {
      button.classList.add("action-allowed");
    } else {
      button.classList.remove("action-allowed");
    }
    button.disabled = !allowed;
  });
}
