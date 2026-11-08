// --- Help & Explain (designs/task185.md) --------------------------------
const compressHelpBtn = document.getElementById("compressHelpBtn");
const compressExplainBtn = document.getElementById("compressExplainBtn");

const COMPRESS_HELP_CONFIG = {
  gameId: "compress",
  title: { zh: "脑力压缩 · Compress", en: "Compress" },
  basic: {
    win: {
      zh: "序列增长到目标长度，或者场上只剩一名玩家时，得分(⭐)最高的玩家获胜。",
      en: "When the sequence reaches the target length, or only one player is left in the game, the player with the highest score (⭐) wins."
    },
    turn: {
      zh: "轮到你时你会看到完整的 0 与 1 序列，先把要点写进八张笔记卡(🗂️)，再按 Hide sequence 把它遮住，然后原样填回整串并提交。",
      en: "On your turn you see the whole sequence of 0s and 1s, write what matters into your eight note cards (🗂️), press Hide sequence to cover it, then rebuild the entire string and submit it."
    },
    key: {
      zh: "这个游戏的重点是压缩记忆，八张笔记卡(🗂️)就是你全部的存储空间，你要发明一套自己的简写，把越来越长的序列塞进去。",
      en: "The key is compressed memory. Your eight note cards (🗂️) are all the storage you get, so you have to invent your own shorthand to fit an ever-growing sequence into them."
    }
  },
  sections: [
    {
      id: "flow",
      label: { zh: "回合流程", en: "Round flow" },
      html: {
        zh: "<p>每回合只有一名玩家是当前行动者，也只有他能看到完整序列。其他玩家在这个阶段一个比特都看不到。</p>"
          + "<p>行动者先把要点写进笔记卡(🗂️)，想遮的时候随时可以按 Hide sequence。遮住之后所有人都只能看到最后八位，更早的部分彻底消失。</p>"
          + "<p>接着行动者要把整串 0 与 1 按顺序填回来并提交，长度必须和当前序列完全一致。</p>"
          + "<p>提交之后本回合结束，行动权交给下一位未被淘汰的玩家。所有在场玩家都按过 Next Round 之后，新回合开始，序列再增长一位。</p>",
        en: "<p>Each round has exactly one active player, and only that player sees the full sequence. Everybody else sees no bits at all during this phase.</p>"
          + "<p>The active player writes the important parts into the note cards (🗂️) and may press Hide sequence whenever they like. After hiding, everyone sees only the last eight bits and everything earlier is gone.</p>"
          + "<p>The active player then rebuilds the entire string of 0s and 1s in order and submits it. The length must match the current sequence exactly.</p>"
          + "<p>Once the answer is in, the turn passes to the next player who is still in the game. After every surviving player presses Next Round, a new round starts and the sequence grows by one bit.</p>"
      }
    },
    {
      id: "notes",
      label: { zh: "笔记卡(🗂️)", en: "Note cards (🗂️)" },
      html: {
        zh: "<p>你开局就拿到八张笔记卡(🗂️)，整局游戏都不会更换。每张卡带一个印刷比特(0️⃣ 或 1️⃣)和一种底色(⬜ 白 或 ⬛ 黑)。</p>"
          + "<p>底色只是帮你给卡片分组，本身没有任何规则差别。真正有用的是你写上去的记录比特。</p>"
          + "<p>写记录的方法是先点一张卡选中槽位，再按 Write 0 或 Write 1。同一个槽位可以反复改写，写下的内容只有你自己看得到。</p>"
          + "<p>记录不会在回合结束时清空，会一直留到你把它改掉，所以前面回合写下的东西后面还能接着用。</p>",
        en: "<p>You start with eight note cards (🗂️) and keep the same eight for the whole game. Each card carries a printed bit (0️⃣ or 1️⃣) and a background colour (⬜ white or ⬛ black).</p>"
          + "<p>The colour only helps you group the cards and has no effect on the rules. What really matters is the bit you record on a card.</p>"
          + "<p>To record, click a card to select that slot and then press Write 0 or Write 1. You may overwrite the same slot as often as you like, and nobody else ever sees what you wrote.</p>"
          + "<p>Recorded bits are not cleared at the end of a round. They stay on the cards until you overwrite them, so what you wrote in earlier rounds is still there later.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分与错误(❌)", en: "Score and errors (❌)" },
      html: {
        zh: "<p>答对时你立刻获得与当前序列长度相同的得分(⭐)。序列每回合增长一位，所以越到后面答对越值钱。</p>"
          + "<p>答错不扣分，但会记一个错误(❌)。错误(❌)累计到上限时你立即被淘汰，之后不再参与任何回合。</p>"
          + "<p>被淘汰的玩家连同他的笔记卡(🗂️)一起离场。场上只剩一人时游戏立刻结束，那个人就是赢家。</p>",
        en: "<p>A correct answer immediately scores points (⭐) equal to the current sequence length. The sequence grows by one bit every round, so a correct answer is worth far more later on.</p>"
          + "<p>A wrong answer takes no points away but adds one error (❌). Once your errors (❌) reach the limit you are eliminated and take no part in any later round.</p>"
          + "<p>An eliminated player leaves together with their note cards (🗂️). When only one player remains the game ends at once and that player wins.</p>"
      }
    },
    {
      id: "ending",
      label: { zh: "结束与胜负", en: "Ending the game" },
      html: {
        zh: "<p>序列从起始长度开始，每回合加一位，一直增长到目标长度。默认设置是三位的起始长度、二十位的目标长度、两次错误(❌)出局。</p>"
          + "<p>当某位玩家在序列已经达到目标长度时提交答案，或者场上只剩一名未被淘汰的玩家，整局游戏就结束。</p>"
          + "<p>结束时在未被淘汰的玩家中比较得分(⭐)，最高的人获胜，同分则并列获胜。任何人按 Play Again 都能用同样的配置重开一局。</p>",
        en: "<p>The sequence starts at the starting length, gains one bit per round and keeps growing until it reaches the target length. The default setup is a starting length of three, a target length of twenty and two errors (❌) before elimination.</p>"
          + "<p>The game ends as soon as a player submits an answer while the sequence has already reached the target length, or when only one player is left in the game.</p>"
          + "<p>At the end the surviving players compare their scores (⭐). The highest score wins, and equal scores share the win. Anyone may press Play Again to restart with the same configuration.</p>"
      }
    }
  ]
};

const COMPRESS_EXPLAIN = {
  sequence: { zh: "当前序列。只有轮到你时才能看到完整的一串 0 与 1，遮住之后所有人都只能看到最后八位。", en: "The current sequence. Only the active player sees the full string of 0s and 1s. After hiding, everybody sees only the last eight bits." },
  notes: { zh: "你的八张笔记卡(🗂️)。点一张选中槽位，再按 Write 0 或 Write 1 写下自己的简写，别人看不到。", en: "Your eight note cards (🗂️). Click one to select that slot, then press Write 0 or Write 1 to record your own shorthand. Nobody else sees it." },
  write_zero: { zh: "把 0 写进当前选中的笔记卡(🗂️)槽位，覆盖原来的记录。", en: "Record a 0 on the currently selected note card (🗂️) slot, replacing whatever was written there." },
  write_one: { zh: "把 1 写进当前选中的笔记卡(🗂️)槽位，覆盖原来的记录。", en: "Record a 1 on the currently selected note card (🗂️) slot, replacing whatever was written there." },
  hide_sequence: { zh: "遮住序列并进入作答阶段。遮住之后你就只能靠笔记卡(🗂️)和最后八位了。", en: "Hide the sequence and move to the answering phase. After this you only have your note cards (🗂️) and the last eight bits." },
  answer: { zh: "作答区。点每一格在问号、0、1 之间循环，把整串序列按顺序填回来。", en: "The answer area. Tap each cell to cycle between the question mark, 0 and 1, and rebuild the whole sequence in order." },
  submit_answer: { zh: "提交你填好的序列。长度必须和当前序列完全一致，而且每一格都要填完。", en: "Submit the sequence you rebuilt. Its length must match the current sequence exactly and every cell must be filled." },
  result: { zh: "本回合的结果，显示谁作答、填了什么、正确答案是什么。所有人按过 Next Round 才会开始新回合。", en: "The result of this round, showing who answered, what they entered and what the correct answer was. A new round starts only after everyone presses Next Round." },
  next_round: { zh: "表示你已经准备好进入下一回合。所有未被淘汰的玩家都按下之后，序列增长一位并继续。", en: "Say that you are ready for the next round. Once every surviving player has pressed it, the sequence grows by one bit and play continues." },
  play_again: { zh: "用同样的配置重开一局，重新发笔记卡(🗂️)并生成新的序列。", en: "Start a fresh game with the same configuration, dealing new note cards (🗂️) and a brand new sequence." },
  players: { zh: "所有玩家的得分(⭐)、错误(❌)数量和当前行动者。错误(❌)达到上限就会被淘汰。", en: "Every player with their score (⭐), their error (❌) count and a marker for the current active player. Reaching the error (❌) limit means elimination." }
};

let compressHelpWidget = null;
let compressExplainWidget = null;

function initCompressHelpExplain() {
  if (compressHelpWidget || typeof window.obgCreateHelp !== "function") return;
  compressHelpWidget = window.obgCreateHelp(COMPRESS_HELP_CONFIG);
  compressExplainWidget = window.obgCreateExplain({
    gameId: "compress",
    attribute: "data-compress-explain",
    explanations: COMPRESS_EXPLAIN,
    button: compressExplainBtn,
    root: () => document.getElementById("compressPanel"),
    bypass: ["#compressHelpBtn", "#compressExplainBtn"]
  });
  compressHelpBtn?.addEventListener("click", () => {
    compressExplainWidget?.exit();
    compressHelpWidget.open();
  });
  compressExplainBtn?.addEventListener("click", () => compressExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCompressHelpExplain);
} else {
  initCompressHelpExplain();
}

let currentCompressView = null;
let compressSelectedSlot = 0;
let compressDraftBits = [];

const compressHeaderActions = document.getElementById("compressHeaderActions");
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
  if (compressStatus) compressStatus.textContent = "";
  if (compressStats) compressStats.innerHTML = "";
  if (compressSequence) compressSequence.innerHTML = "";
  if (compressNotes) compressNotes.innerHTML = "";
  if (compressAnswer) compressAnswer.innerHTML = "";
  compressResult?.classList.add("hidden");
  compressAnswerSection?.classList.add("hidden");
  compressNotesSection?.classList.remove("hidden");
  compressTip?.setAttribute("hidden", "");
  compressExplainWidget?.exit();
  compressHelpWidget?.close();
}

function showCompressHeaderActions(show) {
  if (compressHeaderActions) compressHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    compressExplainWidget?.exit();
    compressHelpWidget?.close();
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
// Help and Explain are handled by static/games/shared_help.js.
