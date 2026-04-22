let currentDumbQuestionsView = null;
let dumbQuestionsExplainMode = false;

const dumbQuestionsHeaderActions = document.getElementById("dumbQuestionsHeaderActions");
const dumbQuestionsHelpBtn = document.getElementById("dumbQuestionsHelpBtn");
const dumbQuestionsExplainBtn = document.getElementById("dumbQuestionsExplainBtn");
const dumbQuestionsHelpModal = document.getElementById("dumbQuestionsHelpModal");
const dumbQuestionsHelpModalCloseBtn = document.getElementById("dumbQuestionsHelpModalCloseBtn");
const dumbQuestionsHelpContent = document.getElementById("dumbQuestionsHelpContent");
const dumbQuestionsExplainModal = document.getElementById("dumbQuestionsExplainModal");
const dumbQuestionsExplainModalCloseBtn = document.getElementById("dumbQuestionsExplainModalCloseBtn");
const dumbQuestionsExplainContent = document.getElementById("dumbQuestionsExplainContent");

const dumbQuestionsPhase = document.getElementById("dumbQuestionsPhase");
const dumbQuestionsRound = document.getElementById("dumbQuestionsRound");
const dumbQuestionsGuesser = document.getElementById("dumbQuestionsGuesser");
const dumbQuestionsCategory = document.getElementById("dumbQuestionsCategory");
const dumbQuestionsStatusBody = document.getElementById("dumbQuestionsStatusBody");
const dumbQuestionsPrompt = document.getElementById("dumbQuestionsPrompt");
const dumbQuestionsPromptCard = document.getElementById("dumbQuestionsPromptCard");
const dumbQuestionsCategoryCard = document.getElementById("dumbQuestionsCategoryCard");
const dumbQuestionsCategories = document.getElementById("dumbQuestionsCategories");
const dumbQuestionsAnswerCard = document.getElementById("dumbQuestionsAnswerCard");
const dumbQuestionsAnswerInput = document.getElementById("dumbQuestionsAnswerInput");
const dumbQuestionsSubmitAnswerBtn = document.getElementById("dumbQuestionsSubmitAnswerBtn");
const dumbQuestionsAnswersCard = document.getElementById("dumbQuestionsAnswersCard");
const dumbQuestionsAnswers = document.getElementById("dumbQuestionsAnswers");
const dumbQuestionsPendingCard = document.getElementById("dumbQuestionsPendingCard");
const dumbQuestionsPendingBody = document.getElementById("dumbQuestionsPendingBody");
const dumbQuestionsRevealBtn = document.getElementById("dumbQuestionsRevealBtn");
const dumbQuestionsBoard = document.getElementById("dumbQuestionsBoard");
const dumbQuestionsSummaryCard = document.getElementById("dumbQuestionsSummaryCard");
const dumbQuestionsSummaryBody = document.getElementById("dumbQuestionsSummaryBody");
const dumbQuestionsPlayers = document.getElementById("dumbQuestionsPlayers");
const dumbQuestionsContinueBtn = document.getElementById("dumbQuestionsContinueBtn");
const dumbQuestionsPlayAgainBtn = document.getElementById("dumbQuestionsPlayAgainBtn");

const DUMB_QUESTIONS_HELP_HTML = `
  <h3>Goal</h3>
  <p>One player is the guesser. Everyone else answers one hidden prompt honestly. The guesser only sees the answers and must infer which prompt was the real one.</p>
  <h3>Round Flow</h3>
  <ol>
    <li>The guesser picks one category.</li>
    <li>The game draws 5 prompts from that category. The first drawn prompt becomes the secret target.</li>
    <li>All answerers see the target prompt and submit one honest answer.</li>
    <li>The guesser reveals the 5 prompts one by one and inserts each prompt into score slots 0 to 4.</li>
    <li>The real target is revealed. The guesser scores the value of the slot holding that prompt.</li>
  </ol>
  <h3>Ranking Rule</h3>
  <p>A newly revealed prompt can be inserted into an occupied slot. Existing prompts will shift toward the nearest empty space, so later reveals can reorder the ranking.</p>
`;

const DUMB_QUESTIONS_EXPLAIN = {
  dumbQuestionsHelpBtn: "Open the rules for this game.",
  dumbQuestionsExplainBtn: "Enter explanation mode. Click an outlined control to see what it does.",
  dumbQuestionsSubmitAnswerBtn: "Submit or update your current answer while the answer phase is open.",
  dumbQuestionsRevealBtn: "Reveal the next unseen prompt card for the guesser.",
  dumbQuestionsContinueBtn: "After scoring, move to the next round.",
  dumbQuestionsPlayAgainBtn: "Restart the whole game with fresh scores and a new first guesser.",
};

function showDumbQuestionsHeaderActions(show) {
  if (dumbQuestionsHeaderActions) {
    dumbQuestionsHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitDumbQuestionsExplainMode();
    if (dumbQuestionsHelpModal) setModalVisible(dumbQuestionsHelpModal, false);
    if (dumbQuestionsExplainModal) setModalVisible(dumbQuestionsExplainModal, false);
  }
}

function dumbQuestionsCan(actionType) {
  return Array.isArray(currentDumbQuestionsView && currentDumbQuestionsView.legal_actions)
    && currentDumbQuestionsView.legal_actions.includes(actionType);
}

function showDumbQuestionsHelpModal() {
  if (!dumbQuestionsHelpModal || !dumbQuestionsHelpContent) return;
  dumbQuestionsHelpContent.innerHTML = DUMB_QUESTIONS_HELP_HTML;
  setModalVisible(dumbQuestionsHelpModal, true);
}

function exitDumbQuestionsExplainMode() {
  dumbQuestionsExplainMode = false;
  document.body.classList.remove("dumb-questions-explain-mode");
  if (dumbQuestionsExplainBtn) dumbQuestionsExplainBtn.classList.remove("active");
}

function showDumbQuestionsExplanation(explainId) {
  if (!dumbQuestionsExplainModal || !dumbQuestionsExplainContent) return;
  const body = DUMB_QUESTIONS_EXPLAIN[explainId];
  if (!body) return;
  dumbQuestionsExplainContent.innerHTML = `<p>${body}</p>`;
  setModalVisible(dumbQuestionsExplainModal, true);
}

function clearDumbQuestionsState() {
  currentDumbQuestionsView = null;
  if (dumbQuestionsPhase) dumbQuestionsPhase.textContent = "-";
  if (dumbQuestionsRound) dumbQuestionsRound.textContent = "-";
  if (dumbQuestionsGuesser) dumbQuestionsGuesser.textContent = "-";
  if (dumbQuestionsCategory) dumbQuestionsCategory.textContent = "-";
  if (dumbQuestionsStatusBody) dumbQuestionsStatusBody.textContent = "-";
  if (dumbQuestionsPrompt) dumbQuestionsPrompt.textContent = "-";
  if (dumbQuestionsCategories) dumbQuestionsCategories.innerHTML = "";
  if (dumbQuestionsAnswers) dumbQuestionsAnswers.innerHTML = "";
  if (dumbQuestionsBoard) dumbQuestionsBoard.innerHTML = "";
  if (dumbQuestionsSummaryBody) dumbQuestionsSummaryBody.textContent = "-";
  if (dumbQuestionsPlayers) dumbQuestionsPlayers.innerHTML = "";
  if (dumbQuestionsAnswerInput) dumbQuestionsAnswerInput.value = "";
  if (dumbQuestionsSummaryCard) dumbQuestionsSummaryCard.classList.add("hidden");
  if (dumbQuestionsRevealBtn) dumbQuestionsRevealBtn.disabled = true;
  if (dumbQuestionsContinueBtn) dumbQuestionsContinueBtn.disabled = true;
  if (dumbQuestionsPlayAgainBtn) dumbQuestionsPlayAgainBtn.disabled = true;
  exitDumbQuestionsExplainMode();
}

function renderDumbQuestionsCategories(view) {
  if (!dumbQuestionsCategories || !dumbQuestionsCategoryCard) return;
  dumbQuestionsCategories.innerHTML = "";
  const canSelect = dumbQuestionsCan("select_category");
  const categories = Array.isArray(view.categories) ? view.categories : [];
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dumb-questions-category-btn";
    button.textContent = category.label || category.id;
    button.disabled = !canSelect;
    button.addEventListener("click", () => {
      if (!canSelect) return;
      sendAction({ type: "select_category", category: category.id });
    });
    dumbQuestionsCategories.appendChild(button);
  });
  dumbQuestionsCategoryCard.classList.toggle("hidden", view.phase !== "category_selection");
}

function renderDumbQuestionsPrompt(view) {
  if (!dumbQuestionsPromptCard || !dumbQuestionsPrompt) return;
  const text = view.prompt_question || "";
  dumbQuestionsPromptCard.classList.toggle("hidden", !text);
  dumbQuestionsPrompt.textContent = text || "-";
}

function renderDumbQuestionsAnswerCard(view) {
  if (!dumbQuestionsAnswerCard || !dumbQuestionsSubmitAnswerBtn || !dumbQuestionsAnswerInput) return;
  const active = dumbQuestionsCan("submit_answer");
  dumbQuestionsAnswerCard.classList.toggle("hidden", view.phase !== "answering");
  dumbQuestionsSubmitAnswerBtn.disabled = !active;
  dumbQuestionsSubmitAnswerBtn.classList.add("has-explanation");
  if (view.phase !== "answering") {
    dumbQuestionsAnswerInput.value = "";
  }
}

function renderDumbQuestionsAnswers(view) {
  if (!dumbQuestionsAnswersCard || !dumbQuestionsAnswers) return;
  const answers = Array.isArray(view.answers) ? view.answers : [];
  dumbQuestionsAnswers.innerHTML = "";
  dumbQuestionsAnswersCard.classList.toggle("hidden", answers.length === 0);
  answers.forEach((entry, index) => {
    const item = document.createElement("div");
    item.className = "dumb-questions-answer-item";
    item.textContent = `${index + 1}. ${entry.answer_text || "-"}`;
    dumbQuestionsAnswers.appendChild(item);
  });
}

function buildDumbQuestionsSlot(slot, view) {
  const wrapper = document.createElement("div");
  wrapper.className = "dumb-questions-slot";
  if (!slot.card_id) wrapper.classList.add("is-empty");
  if (slot.is_target) wrapper.classList.add("is-target");

  const head = document.createElement("div");
  head.className = "dumb-questions-slot-head";

  const score = document.createElement("div");
  score.className = "dumb-questions-slot-score";
  score.textContent = String(slot.slot);
  head.appendChild(score);

  const state = document.createElement("div");
  state.className = "dumb-questions-slot-state";
  state.textContent = slot.card_id ? (slot.is_target ? "Target" : "Locked") : "Empty";
  head.appendChild(state);
  wrapper.appendChild(head);

  const body = document.createElement("div");
  body.className = "dumb-questions-slot-card";
  body.textContent = slot.question_text || "No card placed yet.";
  wrapper.appendChild(body);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "dumb-questions-slot-btn";
  button.textContent = slot.card_id ? `Insert Here (${slot.slot})` : `Place Here (${slot.slot})`;
  const canPlace = dumbQuestionsCan("place_card") && view.pending_card;
  button.disabled = !canPlace;
  button.addEventListener("click", () => {
    if (!canPlace || !view.pending_card) return;
    sendAction({ type: "place_card", slot: slot.slot, card_id: view.pending_card.card_id });
  });
  wrapper.appendChild(button);
  return wrapper;
}

function renderDumbQuestionsBoard(view) {
  if (!dumbQuestionsBoard || !dumbQuestionsPendingCard || !dumbQuestionsPendingBody || !dumbQuestionsRevealBtn) return;
  dumbQuestionsBoard.innerHTML = "";
  const slots = Array.isArray(view.board_slots) ? view.board_slots : [];
  slots.forEach((slot) => dumbQuestionsBoard.appendChild(buildDumbQuestionsSlot(slot, view)));
  const pending = view.pending_card;
  if (pending && pending.question_text) {
    dumbQuestionsPendingBody.textContent = pending.question_text;
  } else if (view.phase === "guessing") {
    dumbQuestionsPendingBody.textContent = "Reveal the next card, then insert it anywhere on the ranking board.";
  } else {
    dumbQuestionsPendingBody.textContent = "No active card.";
  }
  dumbQuestionsPendingCard.classList.toggle("hidden", !["guessing", "reveal", "game_over"].includes(view.phase));
  dumbQuestionsRevealBtn.disabled = !dumbQuestionsCan("reveal_next_card");
  dumbQuestionsRevealBtn.classList.add("has-explanation");
}

function renderDumbQuestionsSummary(view) {
  if (!dumbQuestionsSummaryCard || !dumbQuestionsSummaryBody) return;
  const summary = view.last_round_summary;
  const visible = !!summary && (view.phase === "reveal" || view.phase === "game_over");
  dumbQuestionsSummaryCard.classList.toggle("hidden", !visible);
  if (!visible) {
    dumbQuestionsSummaryBody.textContent = "-";
    return;
  }
  const guesserName = findPlayerName(view, summary.guesser_id);
  const slotText = Number.isInteger(summary.guessed_slot) ? String(summary.guessed_slot) : "-";
  dumbQuestionsSummaryBody.textContent = `${guesserName} placed the real prompt into slot ${slotText} and scored ${summary.points} point(s). Prompt: ${summary.target_question}`;
}

function renderDumbQuestionsPlayers(view) {
  if (!dumbQuestionsPlayers) return;
  dumbQuestionsPlayers.innerHTML = "";
  const players = Array.isArray(view.players) ? view.players : [];
  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "dumb-questions-player-row";
    const tags = [];
    if (player.is_guesser) tags.push("guesser");
    if (player.answered) tags.push("answered");
    const suffix = tags.length ? ` (${tags.join(", ")})` : "";
    row.textContent = `${player.name} · ${player.score} pts${suffix}`;
    dumbQuestionsPlayers.appendChild(row);
  });
}

function renderDumbQuestionsGameState(data) {
  const view = data.view;
  currentDumbQuestionsView = view;
  if (currentGameType !== "dumb_questions") {
    currentGameType = "dumb_questions";
    setGamePanelVisibility("dumb_questions");
  }
  if (dumbQuestionsPhase) dumbQuestionsPhase.textContent = view.phase || "-";
  if (dumbQuestionsRound) dumbQuestionsRound.textContent = `${view.round || 1}/${view.total_rounds || 0}`;
  if (dumbQuestionsGuesser) dumbQuestionsGuesser.textContent = view.guesser_id ? findPlayerName(view, view.guesser_id) : "-";
  if (dumbQuestionsCategory) dumbQuestionsCategory.textContent = view.selected_category_label || "-";
  if (dumbQuestionsStatusBody) dumbQuestionsStatusBody.textContent = view.status_text || "-";
  renderDumbQuestionsPrompt(view);
  renderDumbQuestionsCategories(view);
  renderDumbQuestionsAnswerCard(view);
  renderDumbQuestionsAnswers(view);
  renderDumbQuestionsBoard(view);
  renderDumbQuestionsSummary(view);
  renderDumbQuestionsPlayers(view);
  if (dumbQuestionsContinueBtn) {
    dumbQuestionsContinueBtn.disabled = !dumbQuestionsCan("continue_next_round");
    dumbQuestionsContinueBtn.classList.add("has-explanation");
  }
  if (dumbQuestionsPlayAgainBtn) {
    dumbQuestionsPlayAgainBtn.disabled = !view.game_over;
    dumbQuestionsPlayAgainBtn.classList.add("has-explanation");
  }
  logGameEvents(data);
}

if (dumbQuestionsHelpBtn) {
  dumbQuestionsHelpBtn.addEventListener("click", showDumbQuestionsHelpModal);
}
if (dumbQuestionsHelpModalCloseBtn) {
  dumbQuestionsHelpModalCloseBtn.addEventListener("click", () => setModalVisible(dumbQuestionsHelpModal, false));
}
if (dumbQuestionsExplainBtn) {
  dumbQuestionsExplainBtn.addEventListener("click", () => {
    dumbQuestionsExplainMode = !dumbQuestionsExplainMode;
    document.body.classList.toggle("dumb-questions-explain-mode", dumbQuestionsExplainMode);
    dumbQuestionsExplainBtn.classList.toggle("active", dumbQuestionsExplainMode);
  });
}
if (dumbQuestionsExplainModalCloseBtn) {
  dumbQuestionsExplainModalCloseBtn.addEventListener("click", () => setModalVisible(dumbQuestionsExplainModal, false));
}
if (dumbQuestionsSubmitAnswerBtn) {
  dumbQuestionsSubmitAnswerBtn.addEventListener("click", () => {
    if (!dumbQuestionsCan("submit_answer")) return;
    const answerText = dumbQuestionsAnswerInput ? dumbQuestionsAnswerInput.value.trim() : "";
    if (!answerText) return;
    sendAction({ type: "submit_answer", answer_text: answerText });
  });
}
if (dumbQuestionsRevealBtn) {
  dumbQuestionsRevealBtn.addEventListener("click", () => {
    if (!dumbQuestionsCan("reveal_next_card")) return;
    sendAction({ type: "reveal_next_card" });
  });
}
if (dumbQuestionsContinueBtn) {
  dumbQuestionsContinueBtn.addEventListener("click", () => {
    if (!dumbQuestionsCan("continue_next_round")) return;
    sendAction({ type: "continue_next_round" });
  });
}
if (dumbQuestionsPlayAgainBtn) {
  dumbQuestionsPlayAgainBtn.addEventListener("click", () => {
    sendAction({ type: "play_again" });
  });
}

document.addEventListener("click", (e) => {
  if (!dumbQuestionsExplainMode) return;
  const explainable = e.target.closest(".has-explanation");
  if (!explainable) return;
  const explainId = explainable.id;
  if (!(explainId in DUMB_QUESTIONS_EXPLAIN)) return;
  e.preventDefault();
  e.stopPropagation();
  showDumbQuestionsExplanation(explainId);
  exitDumbQuestionsExplainMode();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dumbQuestionsExplainMode) {
    exitDumbQuestionsExplainMode();
  }
});
