let aidixitDecksLoaded = false;
let aidixitDecks = [];
let aidixitDeckSelections = new Set();
let aidixitSelectedHandCardId = null;
let aidixitSelectedVoteCardId = null;

let currentAidixitView = null;

const aidixitConfigBox = document.getElementById("aidixitConfigBox");
const aidixitDeckRow = document.getElementById("aidixitDeckRow");
const aidixitDeckOptions = document.getElementById("aidixitDeckOptions");
const aidixitPanel = document.getElementById("aidixitPanel");
const aidixitPhaseLabel = document.getElementById("aidixitPhase");
const aidixitRoundLabel = document.getElementById("aidixitRound");
const aidixitStorytellerLabel = document.getElementById("aidixitStoryteller");
const aidixitClueLabel = document.getElementById("aidixitClue");
const aidixitTargetScoreLabel = document.getElementById("aidixitTargetScore");
const aidixitDeckCountLabel = document.getElementById("aidixitDeckCount");
const aidixitDiscardCountLabel = document.getElementById("aidixitDiscardCount");
const aidixitSubmittedLabel = document.getElementById("aidixitSubmitted");
const aidixitVotedLabel = document.getElementById("aidixitVoted");
const aidixitWinnerLabel = document.getElementById("aidixitWinner");
const aidixitClueInput = document.getElementById("aidixitClueInput");
const aidixitSubmitStoryBtn = document.getElementById("aidixitSubmitStoryBtn");
const aidixitSubmitCardBtn = document.getElementById("aidixitSubmitCardBtn");
const aidixitSubmitVoteBtn = document.getElementById("aidixitSubmitVoteBtn");
const aidixitHand = document.getElementById("aidixitHand");
const aidixitPool = document.getElementById("aidixitPool");
const aidixitRoundNotice = document.getElementById("aidixitRoundNotice");
const aidixitRoundNoticeBody = document.getElementById("aidixitRoundNoticeBody");
const aidixitRoundNoticeCards = document.getElementById("aidixitRoundNoticeCards");
const aidixitPlayers = document.getElementById("aidixitPlayers");
const aidixitZoomModal = document.getElementById("aidixitZoomModal");
const aidixitZoomCloseBtn = document.getElementById("aidixitZoomCloseBtn");
const aidixitZoomImage = document.getElementById("aidixitZoomImage");

function updateAidixitDeckRow() {
  const showRow = currentRoomState && currentGameType === "aidixit" && currentRoomState.status === "lobby";
  if (aidixitConfigBox) {
    aidixitConfigBox.classList.toggle("hidden", !showRow);
    aidixitConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (aidixitDeckRow) {
    aidixitDeckRow.classList.toggle("hidden", !showRow);
    aidixitDeckRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow && !aidixitDecksLoaded) {
    fetchAidixitDecks();
  }
}

function fetchAidixitDecks() {
  if (!aidixitDeckOptions) {
    return;
  }
  aidixitDeckOptions.textContent = "Loading decks...";
  fetch("/api/aidixit/decks")
    .then((response) => response.json())
    .then((data) => {
      aidixitDecks = Array.isArray(data.decks) ? data.decks : [];
      aidixitDecksLoaded = true;
      renderAidixitDeckOptions();
    })
    .catch(() => {
      aidixitDeckOptions.textContent = "Failed to load decks.";
      aidixitDecksLoaded = false;
    });
}

function renderAidixitDeckOptions() {
  if (!aidixitDeckOptions) {
    return;
  }
  aidixitDeckOptions.innerHTML = "";
  if (!aidixitDecks.length) {
    aidixitDeckOptions.textContent = "No decks available.";
    return;
  }
  const availableDeckIds = new Set();
  aidixitDecks.forEach((deck) => {
    if (deck.id) {
      availableDeckIds.add(deck.id);
    }
  });
  aidixitDeckSelections = new Set(
    Array.from(aidixitDeckSelections).filter((deckId) => availableDeckIds.has(deckId))
  );
  if (aidixitDeckSelections.size === 0) {
    availableDeckIds.forEach((deckId) => {
      aidixitDeckSelections.add(deckId);
    });
  }
  aidixitDecks.forEach((deck) => {
    const deckId = deck.id;
    if (!deckId) {
      return;
    }
    const label = document.createElement("label");
    label.className = "decrypto-pack-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = deckId;
    checkbox.checked = aidixitDeckSelections.has(deckId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        aidixitDeckSelections.add(deckId);
      } else {
        aidixitDeckSelections.delete(deckId);
      }
    });
    const text = document.createElement("span");
    const name = deck.name || deckId;
    const count = Number.isFinite(deck.count) ? ` (${deck.count})` : "";
    text.textContent = `${name}${count}`;
    label.appendChild(checkbox);
    label.appendChild(text);
    aidixitDeckOptions.appendChild(label);
  });
}

function getSelectedAidixitDecks() {
  return Array.from(aidixitDeckSelections);
}

function openAidixitZoom(imageUrl, altText) {
  if (!aidixitZoomModal || !aidixitZoomImage || !imageUrl) {
    return;
  }
  aidixitZoomImage.src = imageUrl;
  aidixitZoomImage.alt = altText || "Card detail";
  setModalVisible(aidixitZoomModal, true);
}

function closeAidixitZoom() {
  if (!aidixitZoomModal || !aidixitZoomImage) {
    return;
  }
  setModalVisible(aidixitZoomModal, false);
  aidixitZoomImage.src = "";
}

function clearAidixitState() {
  currentAidixitView = null;
  aidixitSelectedHandCardId = null;
  aidixitSelectedVoteCardId = null;
  if (aidixitPhaseLabel) {
    aidixitPhaseLabel.textContent = "-";
  }
  if (aidixitRoundLabel) {
    aidixitRoundLabel.textContent = "-";
  }
  if (aidixitStorytellerLabel) {
    aidixitStorytellerLabel.textContent = "-";
  }
  if (aidixitClueLabel) {
    aidixitClueLabel.textContent = "-";
  }
  if (aidixitTargetScoreLabel) {
    aidixitTargetScoreLabel.textContent = "-";
  }
  if (aidixitDeckCountLabel) {
    aidixitDeckCountLabel.textContent = "-";
  }
  if (aidixitDiscardCountLabel) {
    aidixitDiscardCountLabel.textContent = "-";
  }
  if (aidixitSubmittedLabel) {
    aidixitSubmittedLabel.textContent = "-";
  }
  if (aidixitVotedLabel) {
    aidixitVotedLabel.textContent = "-";
  }
  if (aidixitWinnerLabel) {
    aidixitWinnerLabel.textContent = "-";
  }
  if (aidixitClueInput) {
    aidixitClueInput.value = "";
    aidixitClueInput.disabled = true;
  }
  if (aidixitHand) {
    aidixitHand.innerHTML = "";
  }
  if (aidixitPool) {
    aidixitPool.innerHTML = "";
  }
  if (aidixitRoundNotice) {
    aidixitRoundNotice.classList.add("hidden");
  }
  if (aidixitRoundNoticeBody) {
    aidixitRoundNoticeBody.textContent = "-";
  }
  if (aidixitRoundNoticeCards) {
    aidixitRoundNoticeCards.innerHTML = "";
  }
  if (aidixitPlayers) {
    aidixitPlayers.innerHTML = "";
  }
  updateAidixitButtons();
}

function aidixitCardUrl(cardId) {
  if (!cardId) {
    return "";
  }
  const idx = cardId.indexOf("/");
  if (idx <= 0) {
    return "";
  }
  const deck = cardId.slice(0, idx);
  const file = cardId.slice(idx + 1);
  if (!deck || !file) {
    return "";
  }
  return `/api/aidixit/card?deck=${encodeURIComponent(deck)}&file=${encodeURIComponent(file)}`;
}

function createAidixitCardElement(card, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "aidixit-card";
  if (options.selected) {
    wrapper.classList.add("selected");
  }
  if (options.disabled) {
    wrapper.classList.add("disabled");
  }
  if (options.story) {
    wrapper.classList.add("story");
  }
  const img = document.createElement("img");
  const cardId = card.card_id || "";
  img.src = card.image_url || aidixitCardUrl(cardId);
  img.alt = cardId || "card";
  wrapper.appendChild(img);
  if (options.zoomable) {
    const zoomBtn = document.createElement("button");
    zoomBtn.type = "button";
    zoomBtn.className = "aidixit-zoom-btn";
    zoomBtn.setAttribute("aria-label", "Zoom card");
    zoomBtn.title = "Zoom";
    zoomBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAidixitZoom(img.src, img.alt);
    });
    wrapper.appendChild(zoomBtn);
  }
  if (options.count !== undefined) {
    const badge = document.createElement("div");
    badge.className = "aidixit-card-count";
    badge.textContent = String(options.count);
    wrapper.appendChild(badge);
  }
  if (options.story) {
    const label = document.createElement("div");
    label.className = "aidixit-card-story";
    label.textContent = "Story";
    wrapper.appendChild(label);
  }
  return wrapper;
}

function renderAidixitHand(view) {
  if (!aidixitHand) {
    return;
  }
  aidixitHand.innerHTML = "";
  if (!Array.isArray(view.hand) || !view.hand.length) {
    aidixitHand.textContent = "-";
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const canSelect = (view.phase === "story" && isStoryteller) || (view.phase === "submit" && !isStoryteller);
  const locked = view.game_over || !canSelect || view.submitted;
  view.hand.forEach((card) => {
    const selected = aidixitSelectedHandCardId === card.card_id;
    const cardEl = createAidixitCardElement(card, { selected, disabled: locked, zoomable: true });
    if (!locked) {
      cardEl.addEventListener("click", () => {
        aidixitSelectedHandCardId = card.card_id;
        updateAidixitButtons();
        renderAidixitHand(view);
      });
    }
    aidixitHand.appendChild(cardEl);
  });
}

function renderAidixitPool(view) {
  if (!aidixitPool) {
    return;
  }
  aidixitPool.innerHTML = "";
  if (view.phase !== "vote") {
    aidixitPool.textContent = "-";
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const selectedVoteId = view.voted ? view.vote_card_id : aidixitSelectedVoteCardId;
  const disableAll = view.game_over || view.voted || isStoryteller;
  const poolCards = Array.isArray(view.pool_cards) ? view.pool_cards : [];
  if (!poolCards.length) {
    aidixitPool.textContent = "-";
    return;
  }
  poolCards.forEach((card) => {
    const isOwn = view.your_submission === card.card_id;
    const selected = selectedVoteId === card.card_id;
    const cardEl = createAidixitCardElement(card, {
      selected,
      disabled: disableAll || isOwn,
      zoomable: true,
    });
    if (!disableAll && !isOwn) {
      cardEl.addEventListener("click", () => {
        aidixitSelectedVoteCardId = card.card_id;
        updateAidixitButtons();
        renderAidixitPool(view);
      });
    }
    aidixitPool.appendChild(cardEl);
  });
}

function renderAidixitPlayers(view) {
  if (!aidixitPlayers) {
    return;
  }
  aidixitPlayers.innerHTML = "";
  view.players.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.player_id === view.storyteller_id) {
      card.classList.add("current");
    }

    const header = document.createElement("div");
    header.className = "player-header";
    const nameRow = document.createElement("div");
    nameRow.className = "player-name";
    const colorDot = document.createElement("span");
    colorDot.className = "aidixit-color-dot";
    colorDot.style.backgroundColor = p.color || "#9ca3af";
    nameRow.appendChild(colorDot);
    const nameText = document.createElement("span");
    nameText.textContent = p.name;
    nameRow.appendChild(nameText);
    header.appendChild(nameRow);

    const badges = document.createElement("div");
    badges.className = "player-badges";
    const score = document.createElement("span");
    score.className = "badge";
    score.textContent = `score ${p.score}`;
    badges.appendChild(score);
    if (p.player_id === view.storyteller_id) {
      const storyteller = document.createElement("span");
      storyteller.className = "badge highlight";
      storyteller.textContent = "storyteller";
      badges.appendChild(storyteller);
    }
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
    header.appendChild(badges);

    card.appendChild(header);
    aidixitPlayers.appendChild(card);
  });
}

function renderAidixitRoundNotice(view) {
  if (!aidixitRoundNotice || !aidixitRoundNoticeBody) {
    return;
  }
  const result = view.last_result;
  if (!result) {
    aidixitRoundNotice.classList.add("hidden");
    if (aidixitRoundNoticeCards) {
      aidixitRoundNoticeCards.innerHTML = "";
    }
    return;
  }
  aidixitRoundNotice.classList.remove("hidden");
  const caseMap = {
    all: "All guessed (too obvious)",
    none: "None guessed (too obscure)",
    partial: "Some guessed",
  };
  const label = caseMap[result.case] || result.case || "Round";
  const correctNames = Array.isArray(result.correct_voters) && result.correct_voters.length
    ? result.correct_voters.map((pid) => findPlayerName(view, pid)).join(", ")
    : "none";
  const scoreEntries = result.scores_delta || {};
  const scoreSummary = Object.keys(scoreEntries)
    .map((pid) => {
      const delta = scoreEntries[pid];
      const sign = delta >= 0 ? "+" : "";
      return `${findPlayerName(view, pid)} ${sign}${delta}`;
    })
    .join(", ");
  const clue = result.clue || view.clue || "-";
  const storytellerName = result.storyteller_id ? findPlayerName(view, result.storyteller_id) : "-";
  aidixitRoundNoticeBody.textContent =
    `Storyteller: ${storytellerName} · Clue: ${clue} · ${label} · Correct: ${correctNames}` +
    (scoreSummary ? ` · Scores: ${scoreSummary}` : "");

  if (aidixitRoundNoticeCards) {
    aidixitRoundNoticeCards.innerHTML = "";
    const voteCounts = result.vote_counts || {};
    const votesByCard = result.votes_by_card || {};
    let cardIds = Array.isArray(result.pool_cards) ? result.pool_cards : [];
    if (!cardIds.length) {
      cardIds = Object.keys(voteCounts);
    }
    if (result.story_card && !cardIds.includes(result.story_card)) {
      cardIds = [...cardIds, result.story_card];
    }
    cardIds.forEach((cardId) => {
      const count = voteCounts[cardId];
      const card = { card_id: cardId, image_url: aidixitCardUrl(cardId) };
      const cardEl = createAidixitCardElement(card, {
        count: typeof count === "number" ? count : undefined,
        story: cardId === result.story_card,
        disabled: true,
        zoomable: true,
      });
      const votes = (votesByCard && votesByCard[cardId]) || [];
      if (votes.length) {
        const voteRow = document.createElement("div");
        voteRow.className = "aidixit-votes";
        votes.forEach((vote) => {
          const dot = document.createElement("span");
          dot.className = "aidixit-vote-dot";
          if (vote.color) {
            dot.style.backgroundColor = vote.color;
          }
          if (vote.name) {
            dot.title = vote.name;
          }
          voteRow.appendChild(dot);
        });
        cardEl.appendChild(voteRow);
      }
      aidixitRoundNoticeCards.appendChild(cardEl);
    });
  }
}

function updateAidixitButtons() {
  if (!aidixitSubmitStoryBtn || !aidixitSubmitCardBtn || !aidixitSubmitVoteBtn) {
    return;
  }
  const view = currentAidixitView;
  if (!view || currentGameType !== "aidixit") {
    aidixitSubmitStoryBtn.disabled = true;
    aidixitSubmitCardBtn.disabled = true;
    aidixitSubmitVoteBtn.disabled = true;
    return;
  }
  const isStoryteller = view.storyteller_id === view.you;
  const clueReady = aidixitClueInput && aidixitClueInput.value.trim().length > 0;
  const canStory =
    !view.game_over &&
    view.phase === "story" &&
    isStoryteller &&
    !!aidixitSelectedHandCardId &&
    clueReady;
  const canSubmit =
    !view.game_over &&
    view.phase === "submit" &&
    !isStoryteller &&
    !view.submitted &&
    !!aidixitSelectedHandCardId;
  const canVote =
    !view.game_over &&
    view.phase === "vote" &&
    !isStoryteller &&
    !view.voted &&
    !!aidixitSelectedVoteCardId &&
    aidixitSelectedVoteCardId !== view.your_submission;
  aidixitSubmitStoryBtn.disabled = !canStory;
  aidixitSubmitCardBtn.disabled = !canSubmit;
  aidixitSubmitVoteBtn.disabled = !canVote;
}

function renderAidixitGameState(data) {
  const view = data.view;
  currentAidixitView = view;
  if (currentGameType !== "aidixit") {
    currentGameType = "aidixit";
    setGamePanelVisibility("aidixit");
  }
  if (
    aidixitSelectedHandCardId &&
    (!Array.isArray(view.hand) || !view.hand.some((card) => card.card_id === aidixitSelectedHandCardId))
  ) {
    aidixitSelectedHandCardId = null;
  }
  if (
    aidixitSelectedVoteCardId &&
    (!Array.isArray(view.pool_cards) || !view.pool_cards.some((card) => card.card_id === aidixitSelectedVoteCardId))
  ) {
    aidixitSelectedVoteCardId = null;
  }
  if (view.phase !== "vote") {
    aidixitSelectedVoteCardId = null;
  }

  if (aidixitPhaseLabel) {
    aidixitPhaseLabel.textContent = view.phase || "-";
  }
  if (aidixitRoundLabel) {
    aidixitRoundLabel.textContent = view.round ?? "-";
  }
  if (aidixitStorytellerLabel) {
    aidixitStorytellerLabel.textContent = view.storyteller_id
      ? findPlayerName(view, view.storyteller_id)
      : "-";
  }
  if (aidixitClueLabel) {
    aidixitClueLabel.textContent = view.clue || "-";
  }
  if (aidixitTargetScoreLabel) {
    aidixitTargetScoreLabel.textContent = view.target_score ?? "-";
  }
  if (aidixitDeckCountLabel) {
    aidixitDeckCountLabel.textContent = view.deck_count ?? "-";
  }
  if (aidixitDiscardCountLabel) {
    aidixitDiscardCountLabel.textContent = view.discard_count ?? "-";
  }
  if (aidixitSubmittedLabel) {
    aidixitSubmittedLabel.textContent = view.submitted ? "yes" : "no";
  }
  if (aidixitVotedLabel) {
    aidixitVotedLabel.textContent = view.voted ? "yes" : "no";
  }
  if (aidixitWinnerLabel) {
    if (Array.isArray(view.winner) && view.winner.length) {
      const names = view.winner.map((pid) => findPlayerName(view, pid));
      aidixitWinnerLabel.textContent = names.join(", ");
    } else {
      aidixitWinnerLabel.textContent = "-";
    }
  }

  const isStoryteller = view.storyteller_id === view.you;
  if (aidixitClueInput) {
    const canEdit = !view.game_over && view.phase === "story" && isStoryteller;
    aidixitClueInput.disabled = !canEdit;
    if (!canEdit) {
      aidixitClueInput.value = "";
    }
  }

  renderAidixitHand(view);
  renderAidixitPool(view);
  renderAidixitPlayers(view);
  renderAidixitRoundNotice(view);
  logGameEvents(data);
  updateAidixitButtons();
}

if (aidixitZoomCloseBtn) {
  aidixitZoomCloseBtn.addEventListener("click", () => {
    closeAidixitZoom();
  });
}

if (aidixitZoomModal) {
  aidixitZoomModal.addEventListener("click", (event) => {
    if (event.target === aidixitZoomModal) {
      closeAidixitZoom();
    }
  });
}

if (aidixitClueInput) {
  aidixitClueInput.addEventListener("input", () => updateAidixitButtons());
}

if (aidixitSubmitStoryBtn) {
  aidixitSubmitStoryBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedHandCardId;
    if (!cardId) {
      log("Select a card");
      return;
    }
    const clue = aidixitClueInput ? aidixitClueInput.value.trim() : "";
    if (!clue) {
      log("Enter a clue");
      return;
    }
    sendAction({ type: "submit_story", card_id: cardId, clue });
    aidixitSelectedHandCardId = null;
    if (aidixitClueInput) {
      aidixitClueInput.value = "";
    }
    updateAidixitButtons();
  });
}

if (aidixitSubmitCardBtn) {
  aidixitSubmitCardBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedHandCardId;
    if (!cardId) {
      log("Select a card");
      return;
    }
    sendAction({ type: "submit_card", card_id: cardId });
    aidixitSelectedHandCardId = null;
    updateAidixitButtons();
  });
}

if (aidixitSubmitVoteBtn) {
  aidixitSubmitVoteBtn.addEventListener("click", () => {
    if (!currentAidixitView) {
      log("Game not ready");
      return;
    }
    const cardId = aidixitSelectedVoteCardId;
    if (!cardId) {
      log("Select a card to vote");
      return;
    }
    if (cardId === currentAidixitView.your_submission) {
      log("Cannot vote for your own card");
      return;
    }
    sendAction({ type: "submit_vote", card_id: cardId });
    aidixitSelectedVoteCardId = null;
    updateAidixitButtons();
  });
}
