let currentCompressView = null;
let compressSelectedSlot = 0;
let compressDraftBits = [];
let compressExplainMode = false;

const compressHeaderActions = document.getElementById("compressHeaderActions");
const compressHelpBtn = document.getElementById("compressHelpBtn");
const compressExplainBtn = document.getElementById("compressExplainBtn");
const compressHelpModal = document.getElementById("compressHelpModal");
const compressHelpClose = document.getElementById("compressHelpClose");
const compressTip = document.getElementById("compressTip");
const compressStatus = document.getElementById("compressStatus");
const compressStats = document.getElementById("compressStats");
const compressSequence = document.getElementById("compressSequence");
const compressSequenceMeta = document.getElementById("compressSequenceMeta");
const compressSequenceHint = document.getElementById("compressSequenceHint");
const compressNotes = document.getElementById("compressNotes");
const compressNotesSection = document.getElementById("compressNotesSection");
const compressAnswerSection = document.getElementById("compressAnswerSection");
const compressAnswer = document.getElementById("compressAnswer");
const compressSubmitBtn = document.getElementById("compressSubmitBtn");
const compressHideBtn = document.getElementById("compressHideBtn");
const compressResult = document.getElementById("compressResult");
const compressResultTitle = document.getElementById("compressResultTitle");
const compressResultBody = document.getElementById("compressResultBody");
const compressReadyHint = document.getElementById("compressReadyHint");
const compressNextBtn = document.getElementById("compressNextBtn");
const compressPlayAgainBtn = document.getElementById("compressPlayAgainBtn");
const compressPlayers = document.getElementById("compressPlayers");

function compressCan(action) {
  return Boolean(currentCompressView && Array.isArray(currentCompressView.legal_actions)
    && currentCompressView.legal_actions.includes(action));
}

function compressEscape(value) {
  const text = String(value ?? "");
  return text.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]));
}

function compressPlayerName(view, playerId) {
  const player = (view.players || []).find((entry) => entry.player_id === playerId);
  return player ? player.name : playerId || "-";
}

function compressSetStatus(view) {
  if (!compressStatus) return;
  const currentName = compressPlayerName(view, view.current_turn);
  if (view.game_over) {
    const names = (view.winner_ids || []).map((id) => compressPlayerName(view, id)).join(", ");
    compressStatus.textContent = names ? `🏆 Winner: ${names}` : "Game over";
  } else if (view.phase === "memorize") {
    compressStatus.textContent = view.current_turn === view.you
      ? "Study the sequence, write your own shorthand into the eight slots, then hide it."
      : `${currentName} is studying the sequence.`;
  } else if (view.phase === "answering") {
    compressStatus.textContent = view.current_turn === view.you
      ? "Rebuild the complete sequence from your notes."
      : `${currentName} is rebuilding the sequence.`;
  } else {
    compressStatus.textContent = `Round complete. Everyone press Next Round (${view.round_ready || 0}/${view.active_player_count || 0}).`;
  }
}

function compressRenderStats(view) {
  if (!compressStats) return;
  const me = (view.players || []).find((entry) => entry.player_id === view.you);
  compressStats.innerHTML = "";
  [
    [`Round ${view.round ?? "-"}`, false],
    [`Length ${view.sequence_length ?? "-"}/${view.config?.target_length ?? "-"}`, false],
    [`⭐ ${me?.score ?? 0}`, false],
    [`❌ ${me?.errors ?? 0}/${view.config?.max_errors ?? 2}`, (me?.errors ?? 0) > 0],
  ].forEach(([label, alert]) => {
    const item = document.createElement("span");
    item.className = `compress-stat${alert ? " is-alert" : ""}`;
    item.textContent = label;
    compressStats.appendChild(item);
  });
}

function compressRenderSequence(view) {
  if (!compressSequence) return;
  compressSequence.innerHTML = "";
  let bits = Array.isArray(view.memorize_sequence) ? view.memorize_sequence : [];
  if (view.phase !== "memorize") {
    bits = Array.isArray(view.sequence_tail) ? view.sequence_tail : [];
    if ((view.sequence_length || 0) > bits.length) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "compress-sequence-bit muted";
      ellipsis.textContent = "…";
      ellipsis.title = "Earlier bits are hidden; use your notes.";
      compressSequence.appendChild(ellipsis);
    }
  }
  if (!bits.length) {
    const empty = document.createElement("span");
    empty.className = "compress-caption";
    empty.textContent = view.phase === "memorize" ? "Waiting for the active player…" : "Hidden until the next reveal.";
    compressSequence.appendChild(empty);
  }
  bits.forEach((bit, index) => {
    const item = document.createElement("span");
    const numeric = Number(bit) === 1 ? 1 : 0;
    item.className = `compress-sequence-bit ${numeric ? "one" : "zero"}`;
    item.textContent = numeric ? "1" : "0";
    item.title = `Sequence position ${index + 1}`;
    compressSequence.appendChild(item);
  });
  if (compressSequenceMeta) {
    compressSequenceMeta.textContent = `${view.sequence_length || 0} bit${view.sequence_length === 1 ? "" : "s"}`;
  }
}

function compressRenderNotes(view) {
  if (!compressNotes) return;
  const me = (view.players || []).find((entry) => entry.player_id === view.you);
  const notes = Array.isArray(me?.notes) ? me.notes : [];
  const editable = view.phase === "memorize" && view.current_turn === view.you && compressCan("write_note");
  compressNotes.innerHTML = "";
  notes.forEach((note) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `compress-note${note.color === "black" ? " is-black" : ""}${compressSelectedSlot === note.slot ? " is-selected" : ""}`;
    button.disabled = !editable;
    button.setAttribute("aria-pressed", String(compressSelectedSlot === note.slot));
    button.title = `Note slot ${note.slot + 1}: printed ${note.card_bit ? "1" : "0"}`;
    button.innerHTML = `<span class="compress-note-id">Slot ${note.slot + 1}</span><span class="compress-note-card-bit">${note.card_bit ? "1️⃣" : "0️⃣"}</span><span class="compress-note-record${note.recorded_bit === null ? " empty" : ""}">${note.recorded_bit === null ? "empty" : `memo ${note.recorded_bit}`}</span>`;
    button.addEventListener("click", () => {
      compressSelectedSlot = note.slot;
      compressRenderNotes(currentCompressView);
      compressShowTip(button, `Slot ${note.slot + 1} selected`);
    });
    compressNotes.appendChild(button);
  });
}

function compressInitialDraft(view) {
  const me = (view.players || []).find((entry) => entry.player_id === view.you);
  const notes = Array.isArray(me?.notes) ? me.notes : [];
  return Array.from({ length: view.sequence_length || 0 }, (_, index) => {
    const recorded = notes[index % notes.length]?.recorded_bit;
    return recorded === 0 || recorded === 1 ? recorded : null;
  });
}

function compressRenderAnswer(view) {
  const answering = view.phase === "answering" && view.current_turn === view.you;
  compressAnswerSection?.classList.toggle("hidden", !answering);
  if (!answering || !compressAnswer) return;
  if (compressDraftBits.length !== view.sequence_length) {
    compressDraftBits = compressInitialDraft(view);
  }
  compressAnswer.innerHTML = "";
  compressDraftBits.forEach((bit, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `compress-answer-cell${bit === null ? " is-unknown" : ""}`;
    button.textContent = bit === null ? "?" : String(bit);
    button.title = `Sequence position ${index + 1}; tap to change`;
    button.addEventListener("click", () => {
      const current = compressDraftBits[index];
      compressDraftBits[index] = current === null ? 0 : current === 0 ? 1 : null;
      compressRenderAnswer(currentCompressView);
    });
    compressAnswer.appendChild(button);
  });
  const complete = compressDraftBits.length === view.sequence_length && compressDraftBits.every((bit) => bit === 0 || bit === 1);
  if (compressSubmitBtn) {
    compressSubmitBtn.disabled = !complete || !compressCan("answer");
    compressSubmitBtn.classList.toggle("action-allowed", !compressSubmitBtn.disabled);
  }
}

function compressRenderPlayers(view) {
  if (!compressPlayers) return;
  compressPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const row = document.createElement("div");
    row.className = `compress-player${player.player_id === view.you ? " is-you" : ""}${player.player_id === view.current_turn ? " is-turn" : ""}${player.eliminated ? " is-out" : ""}`;
    const name = document.createElement("span");
    name.className = "compress-player-name";
    name.textContent = `${player.player_id === view.you ? "You · " : ""}${player.name || player.player_id}${player.player_id === view.current_turn ? " · 🎯" : ""}`;
    const meta = document.createElement("span");
    meta.className = "compress-player-meta";
    meta.textContent = `${player.eliminated ? "OUT · " : ""}⭐ ${player.score} · ❌ ${player.errors}/${view.config?.max_errors ?? 2}`;
    row.append(name, meta);
    compressPlayers.appendChild(row);
  });
}

function compressRenderResult(view) {
  const result = view.phase === "round_result" || view.game_over;
  compressResult?.classList.toggle("hidden", !result);
  if (!result || !compressResultBody) return;
  const summary = view.round_summary;
  if (view.game_over) {
    compressResultTitle.textContent = "🏁 Game over";
    const names = (view.winner_ids || []).map((id) => compressPlayerName(view, id)).join(", ");
    compressResultBody.textContent = names ? `Winner: ${names}. The final sequence had ${summary?.sequence_length || view.sequence_length} bits.` : "No winner.";
    compressNextBtn?.classList.add("hidden");
    compressPlayAgainBtn?.classList.toggle("hidden", !compressCan("play_again"));
    return;
  }
  const name = compressPlayerName(view, summary?.player_id);
  compressResultTitle.textContent = summary?.correct ? "✅ Correct" : "❌ Compressed incorrectly";
  compressResultBody.textContent = `${name} entered ${summary?.submitted || "-"}. Expected ${summary?.expected || "-"}. ${summary?.correct ? `+${summary.sequence_length} points.` : summary?.eliminated ? "That player is out." : "One error marker added."}`;
  compressReadyHint.textContent = `Next Round · ${view.round_ready || 0}/${view.active_player_count || 0} ready`;
  compressNextBtn?.classList.toggle("hidden", !compressCan("next_round"));
  if (compressNextBtn) compressNextBtn.disabled = !compressCan("next_round");
  compressPlayAgainBtn?.classList.add("hidden");
}

function compressUpdateControls(view) {
  const editable = view.phase === "memorize" && view.current_turn === view.you;
  compressNotesSection?.classList.toggle("hidden", view.phase === "answering" || view.phase === "round_result" || view.game_over);
  if (compressHideBtn) {
    compressHideBtn.disabled = !editable || !compressCan("hide_sequence");
    compressHideBtn.classList.toggle("action-allowed", !compressHideBtn.disabled);
  }
  document.querySelectorAll("[data-compress-note-bit]").forEach((button) => {
    button.disabled = !editable || !compressCan("write_note");
  });
  if (compressSequenceHint) {
    compressSequenceHint.textContent = editable ? "Your turn: record enough of the sequence, then hide it." : "The active player controls the sequence. Your notes stay private.";
  }
}

function compressRenderGameState(data) {
  const view = data?.view;
  if (!view) return;
  const previousPhase = currentCompressView?.phase;
  currentCompressView = view;
  if (currentGameType !== "compress") {
    currentGameType = "compress";
    setGamePanelVisibility("compress");
  }
  if (previousPhase !== view.phase && view.phase !== "answering") compressDraftBits = [];
  compressSetStatus(view);
  compressRenderStats(view);
  compressRenderSequence(view);
  compressRenderNotes(view);
  compressRenderAnswer(view);
  compressRenderPlayers(view);
  compressRenderResult(view);
  compressUpdateControls(view);
}

function clearCompressState() {
  currentCompressView = null;
  compressSelectedSlot = 0;
  compressDraftBits = [];
  compressExplainMode = false;
  if (compressStatus) compressStatus.textContent = "";
  if (compressStats) compressStats.innerHTML = "";
  if (compressSequence) compressSequence.innerHTML = "";
  if (compressNotes) compressNotes.innerHTML = "";
  if (compressAnswer) compressAnswer.innerHTML = "";
  compressResult?.classList.add("hidden");
  compressAnswerSection?.classList.add("hidden");
  compressNotesSection?.classList.remove("hidden");
  compressTip?.setAttribute("hidden", "");
  compressHelpModal?.open && compressHelpModal.close();
  compressExplainBtn?.setAttribute("aria-pressed", "false");
  document.querySelector(".compress-game")?.classList.remove("is-explaining");
}

function showCompressHeaderActions(show) {
  if (compressHeaderActions) compressHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    compressExplainMode = false;
    compressExplainBtn?.setAttribute("aria-pressed", "false");
    compressHelpModal?.open && compressHelpModal.close();
  }
}

function compressShowTip(target, text) {
  if (!compressTip) return;
  compressTip.textContent = text;
  compressTip.hidden = false;
  const rect = target.getBoundingClientRect();
  compressTip.style.left = `${Math.max(12, Math.min(window.innerWidth - compressTip.offsetWidth - 12, rect.left))}px`;
  compressTip.style.top = `${Math.max(12, rect.bottom + 8)}px`;
  window.clearTimeout(compressShowTip.timer);
  compressShowTip.timer = window.setTimeout(() => { compressTip.hidden = true; }, 3000);
}

document.querySelectorAll("[data-compress-note-bit]").forEach((button) => button.addEventListener("click", () => {
  if (!currentCompressView || !compressCan("write_note")) return;
  const bit = Number(button.dataset.compressNoteBit);
  sendAction({ type: "write_note", slot: compressSelectedSlot, bit });
}));
compressHideBtn?.addEventListener("click", () => { if (compressCan("hide_sequence")) sendAction({ type: "hide_sequence" }); });
compressSubmitBtn?.addEventListener("click", () => {
  if (!compressCan("answer") || compressDraftBits.some((bit) => bit === null)) return;
  sendAction({ type: "answer", bits: compressDraftBits.join("") });
});
compressNextBtn?.addEventListener("click", () => { if (compressCan("next_round")) sendAction({ type: "next_round" }); });
compressPlayAgainBtn?.addEventListener("click", () => { if (compressCan("play_again")) sendAction({ type: "play_again" }); });
compressHelpBtn?.addEventListener("click", () => compressHelpModal?.showModal());
compressHelpClose?.addEventListener("click", () => compressHelpModal?.close());
compressExplainBtn?.addEventListener("click", () => {
  compressExplainMode = !compressExplainMode;
  compressExplainBtn.setAttribute("aria-pressed", String(compressExplainMode));
  document.querySelector(".compress-game")?.classList.toggle("is-explaining", compressExplainMode);
  if (!compressExplainMode && compressTip) compressTip.hidden = true;
});
document.addEventListener("click", (event) => {
  if (!compressExplainMode || currentGameType !== "compress") return;
  const target = event.target.closest("[data-compress-explain]");
  if (!target || target === compressExplainBtn) return;
  const labels = {
    sequence: "Sequence: the active player studies these bits before hiding them.",
    notes: "Note cards: eight private slots for your own compression shorthand.",
    answer: "Tap each cell to rebuild the hidden sequence, then submit.",
    players: "Players show score, error markers, and whose turn it is.",
    result: "Round result: everyone must press Next Round before play continues.",
  };
  compressShowTip(target, labels[target.dataset.compressExplain] || "Game element");
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (compressHelpModal?.open) compressHelpModal.close();
  if (compressExplainMode) {
    compressExplainMode = false;
    compressExplainBtn?.setAttribute("aria-pressed", "false");
    document.querySelector(".compress-game")?.classList.remove("is-explaining");
    if (compressTip) compressTip.hidden = true;
  }
});
