(() => {
  const id = (name) => document.getElementById(`semanticGuess${name}`);
  const panel = id("Panel");
  let view = null;
  let activeRoom = null;
  let pending = false;
  let pendingWord = "";
  let explainMode = false;
  let sortMode = "newest";
  let tipTimer = null;
  const ownId = () => view?.you || (typeof playerId !== "undefined" ? playerId : null);
  const active = () => typeof currentGameType === "undefined" || currentGameType === "semantic_guess";
  const connected = () => typeof socket !== "undefined" && socket.connected && (typeof roomSessionReady === "undefined" || roomSessionReady);
  const setText = (name, value) => { const element = id(name); if (element) element.textContent = value; };
  const node = (tag, cls, value) => { const element = document.createElement(tag); element.className = cls; if (value != null) element.textContent = value; return element; };
  const nameFor = (pid) => view?.players?.find((p) => p.player_id === pid)?.name || pid || "—";
  const normalizeScore = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const scoreText = (value) => { const score = normalizeScore(value); return score == null ? "—" : `${(score * 100).toFixed(2)}%`; };
  const ownPlayer = () => view?.players?.find((p) => p.player_id === ownId());
  const ownRiichi = () => Boolean(view?.you_riichi ?? view?.is_riichi ?? ownPlayer()?.riichi ?? ownPlayer()?.is_riichi);
  const riichiAction = () => ["declare_riichi", "riichi", "set_riichi"].find((type) => view?.legal_actions?.includes(type));
  const can = (type) => connected() && !pending && Boolean(view?.legal_actions?.includes(type));
  const wordVisible = (entry) => Boolean(entry && !entry.skipped && entry.word != null && entry.word !== "" && entry.word_hidden !== true && entry.word_visible !== false && entry.hidden !== true);
  const wordLabel = (entry) => entry?.skipped ? "跳过" : wordVisible(entry) ? entry.word : "🔒 词语已隐藏";
  const endReason = () => view?.end_reason || view?.game_end_reason || view?.result || "";
  const allPass = () => endReason() === "all_passed" || endReason() === "all_pass" || (!!view?.game_over && !view?.winner_id);
  const explanations = {
    turn: ["当前回合", "大家按座位顺序轮流猜词。提交成功或点击 Pass 后轮到下一位玩家。"],
    target: ["暗词", "暗词会在有人准确猜中或所有玩家都 Pass 后揭晓。"],
    latest: ["最近猜测", "显示最近线索和相似度。立直期间，其他玩家的词只显示为隐藏标记。"],
    best: ["最佳线索", "目前相似度最高的猜词；高分不代表已经猜中。"],
    similarity: ["语义相似度", "余弦相似度范围为 −100% 到 100%，不是猜中概率。"],
    guess: ["Guess · 提交猜词", "输入词语后提交。错误输入不会消耗回合。"],
    pass: ["Pass · 跳过回合", "放弃本次机会并轮到下一位。"],
    riichi: ["Riichi · 立直", "立直后锁定到本轮结束，不能取消。你看不到别人猜的词，别人也看不到你的词，但相似度仍可见。"],
    players: ["玩家顺序", "按座位顺序轮流猜词。▶ 表示当前玩家。"],
    sort: ["记录排序", "Newest 按回合倒序；Similarity 按相似度排序。"],
  };
  const help = `<h3>找到同一个暗词</h3><p>1–10 人轮流猜词，单人也可以开始。准确猜中者获胜；如果所有玩家都 Pass，会显示暗词。</p><h3>每次轮到你</h3><ol><li>输入词语，点击 <strong>Guess</strong> 或按 Enter。</li><li>根据相似度继续推理，也可以点击 <strong>Pass</strong>。</li><li>选择 <strong>Riichi</strong> 后立直持续到本轮结束，不能取消。立直期间只显示相似度，词语对相关玩家隐藏。</li></ol><h3>结束</h3><p>有人猜中或所有人 Pass 后，暗词会对所有玩家揭晓。使用 Room Controls 的 Restart 开始新局。</p>`;

  function showDialog(title, content, html = false) {
    setExplain(false); setText("DialogTitle", title); const contentEl = id("DialogContent");
    if (html) contentEl.innerHTML = content; else contentEl.replaceChildren(node("p", "", content));
    const dialog = id("Dialog"); if (!dialog.open) dialog.showModal(); id("DialogCloseBtn").focus({ preventScroll: true });
  }
  function setExplain(enabled) { explainMode = enabled; panel.classList.toggle("semantic-guess-explain-mode", enabled); id("ExplainBtn").setAttribute("aria-pressed", String(enabled)); hideTip(); }
  function hideTip() { clearTimeout(tipTimer); id("Tooltip").hidden = true; }
  function showTip(target) { hideTip(); if (!target?.dataset.sgTip || explainMode) return; const tip = id("Tooltip"); tip.textContent = target.dataset.sgTip; tip.hidden = false; const rect = target.getBoundingClientRect(); tip.style.left = `${Math.max(12, Math.min(innerWidth - tip.offsetWidth - 12, rect.left))}px`; tip.style.top = `${Math.max(12, Math.min(innerHeight - tip.offsetHeight - 12, rect.bottom + 8))}px`; tipTimer = setTimeout(hideTip, 3000); }
  function readout(prefix, entry) { setText(`${prefix}Player`, entry ? entry.player_name || nameFor(entry.player_id) : "—"); setText(`${prefix}Word`, entry ? wordLabel(entry) : prefix === "Latest" ? "等待第一条线索" : "尚无猜测"); setText(`${prefix}Score`, scoreText(entry?.similarity)); const marker = id(`${prefix}Marker`); const score = normalizeScore(entry?.similarity); marker.style.visibility = entry && score != null ? "visible" : "hidden"; marker.style.left = `${Math.max(0, Math.min(100, ((score || 0) + 1) * 50))}%`; }
  function renderHistory() {
    const list = id("History"); const entries = (view?.guesses || []).map((entry, i) => ({ ...entry, order: entry.turn_number || i + 1 }));
    if (sortMode === "similarity") entries.sort((a, b) => (normalizeScore(b.similarity) ?? -Infinity) - (normalizeScore(a.similarity) ?? -Infinity) || b.order - a.order); else entries.reverse();
    list.replaceChildren(); setText("Count", entries.length);
    if (!entries.length) list.append(node("div", "semantic-guess-empty", "还没有线索，先试一个词吧。"));
    entries.forEach((entry) => {
      const row = node("div", "semantic-guess-history-row"); row.classList.toggle("is-you", entry.is_you || entry.player_id === ownId()); row.classList.toggle("is-correct", Boolean(entry.correct));
      const word = node("span", `semantic-guess-history-word${!wordVisible(entry) && !entry.skipped ? " is-hidden" : ""}`, wordLabel(entry));
      const score = node("span", "semantic-guess-history-score", entry.correct ? "✓ 猜中了" : scoreText(entry.similarity));
      row.append(node("span", "semantic-guess-history-order", `#${entry.order}`), word, node("span", "semantic-guess-history-player", `${entry.player_name || nameFor(entry.player_id)}${entry.is_you || entry.player_id === ownId() ? " · You" : ""}`), score); list.append(row);
    });
    id("NewestBtn").setAttribute("aria-pressed", String(sortMode === "newest")); id("SimilarityBtn").setAttribute("aria-pressed", String(sortMode === "similarity"));
  }
  function updateActions() {
    const submit = can("submit_guess"); const pass = can("skip_turn"); const action = riichiAction(); const mode = id("ModeRow"); const button = id("RiichiBtn"); const enabled = Boolean(action || ownRiichi() || view?.riichi_enabled || view?.supports_riichi || view?.config?.riichi_enabled);
    mode.hidden = !enabled; button.disabled = pending || !action || ownRiichi() || Boolean(view?.game_over); button.textContent = ownRiichi() ? "Riichi ✓" : pending ? "…" : "Riichi"; setText("RiichiState", ownRiichi() ? "立直已锁定，直到本轮结束" : enabled ? "可选模式 · 不能取消" : ""); id("RiichiState").classList.toggle("is-locked", ownRiichi());
    id("Input").disabled = !submit; id("SubmitBtn").disabled = !submit || !id("Input").value.trim(); id("PassBtn").disabled = !pass; setText("SubmitBtn", pending ? "…" : "Guess");
    setText("InputHint", !connected() ? "Reconnecting…" : pending ? "正在计算相似度…" : !view ? "等待开始" : view.game_over ? "本局已结束，暗词已揭晓，可在 Room Controls 中 Restart" : submit ? "轮到你了" : `等待 ${nameFor(view.current_turn_player_id)} 猜词`);
  }
  function render() {
    const guesses = (view?.guesses || []).filter((entry) => !entry.skipped && normalizeScore(entry.similarity) != null); const best = guesses.reduce((a, b) => !a || b.similarity > a.similarity ? b : a, null); const current = view?.current_turn_player_id; const won = Boolean(view?.game_over);
    const status = !view ? "等待开始" : won ? (allPass() ? "🏁 所有人都 Pass，暗词已揭晓" : view.winner_id ? `🏆 ${view.winner_name || nameFor(view.winner_id)} 猜中了暗词` : "🏁 本局结束，暗词已揭晓") : current === ownId() ? "轮到你猜词" : current ? `${nameFor(current)} 正在猜词` : "等待下一回合";
    setText("Status", status); id("Status").parentElement.classList.toggle("is-your-turn", Boolean(view && !won && current === ownId())); setText("Turn", view ? `第 ${view.turn_number || (view.guesses?.length || 0) + 1} 回合 · ${view.players?.length || 1} 人` : "1–10 人"); setText("TargetLabel", won ? "暗词揭晓" : "暗词已隐藏"); setText("TargetIcon", won ? "✓" : "?"); setText("Answer", won ? view.secret_word || "—" : "找到共同的答案"); setText("Outcome", won ? (allPass() ? "所有玩家都跳过了回合，暗词现在对所有人揭晓。" : "本局结束，暗词现在对所有人揭晓。") : ownRiichi() ? "立直已锁定到本轮结束：你只能看到其他猜词的相似度。" : "从一个词开始，跟随语义线索。"); id("Answer").closest("section").classList.toggle("is-won", won);
    readout("Latest", guesses[guesses.length - 1]); readout("Best", best); const players = id("Players"); players.replaceChildren(); (view?.players || []).forEach((player, i) => { const chip = node("span", "semantic-guess-player"); chip.classList.toggle("is-current", player.player_id === current); chip.classList.toggle("is-you", player.player_id === ownId()); chip.append(node("span", "semantic-guess-player-mark", player.player_id === current ? "▶" : `${i + 1}`), node("span", "", `${player.name}${player.player_id === ownId() ? " · You" : ""}${player.is_bot ? " · Bot" : ""}${player.riichi ? " · Riichi ✓" : ""}`)); players.append(chip); }); renderHistory(); updateActions();
  }
  function send(type) { if (!view || pending || !connected() || !view.legal_actions?.includes(type)) return; const word = id("Input").value.trim(); if (type === "submit_guess" && !word) return; pending = true; pendingWord = type === "submit_guess" ? word : ""; setText("Feedback", ""); updateActions(); const action = { type, game_token: view.game_token, turn_number: view.turn_number }; if (type === "submit_guess") action.word = word; sendAction(action); }
  function sendRiichi() { const type = riichiAction(); if (!type || pending || ownRiichi() || !connected() || view?.game_over) return; pending = true; setText("Feedback", ""); updateActions(); sendAction({ type, game_token: view.game_token, turn_number: view.turn_number }); }
  function clear() { view = null; pending = false; pendingWord = ""; id("Input").value = ""; setText("Feedback", ""); if (id("Dialog").open) id("Dialog").close(); setExplain(false); render(); }

  id("Form").addEventListener("submit", (event) => { event.preventDefault(); send("submit_guess"); }); id("Input").addEventListener("input", updateActions); id("PassBtn").addEventListener("click", () => send("skip_turn")); id("RiichiBtn").addEventListener("click", sendRiichi); id("HelpBtn").addEventListener("click", () => showDialog("词语雷达 · Help", help, true)); id("ExplainBtn").addEventListener("click", () => setExplain(!explainMode)); id("DialogCloseBtn").addEventListener("click", () => id("Dialog").close()); ["Newest", "Similarity"].forEach((name) => id(`${name}Btn`).addEventListener("click", () => { sortMode = name.toLowerCase(); renderHistory(); }));
  panel.addEventListener("pointerdown", (event) => { if (!explainMode) return; const target = event.target.closest?.("[data-sg-explain]"); if (!target) return; const info = explanations[target.dataset.sgExplain]; if (!info) return; event.preventDefault(); event.stopPropagation(); showDialog(...info); }, true);
  panel.addEventListener("pointerover", (event) => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-sg-tip]")); }); panel.addEventListener("pointerup", (event) => { if (event.pointerType !== "mouse") showTip(event.target.closest("[data-sg-tip]")); }); panel.addEventListener("pointerout", (event) => { if (event.pointerType === "mouse") hideTip(); }); panel.addEventListener("focusin", (event) => showTip(event.target.closest("[data-sg-tip]"))); panel.addEventListener("focusout", hideTip); document.addEventListener("scroll", hideTip, true); document.addEventListener("keydown", (event) => { if (!active()) return; if (event.key === "Escape") { setExplain(false); if (id("Dialog").open) id("Dialog").close(); } if (explainMode && event.key === "Enter") { const target = event.target.closest?.("[data-sg-explain]"); if (target) { event.preventDefault(); const info = explanations[target.dataset.sgExplain]; if (info) showDialog(...info); } } });
  document.addEventListener("click", (event) => { if (!active() || !explainMode || event.target.closest("#semanticGuessHelpBtn,#semanticGuessExplainBtn,#semanticGuessDialogCloseBtn")) return; const target = event.target.closest("[data-sg-explain]"); if (!target) return; event.preventDefault(); const info = explanations[target.dataset.sgExplain]; if (info) showDialog(...info); }, true);
  window.renderSemanticGuessGameState = (data) => { if (!active() || data?.game_type && data.game_type !== "semantic_guess" || data?.room_id && data.room_id !== currentRoomState?.room_id) return; const next = data?.view || data; if (!next || next.game_id && next.game_id !== "semantic_guess") return; if (pendingWord && next.guesses?.some((entry) => entry.player_id === ownId() && entry.word === pendingWord)) id("Input").value = ""; view = next; pending = false; pendingWord = ""; setText("Feedback", ""); render(); };
  window.showSemanticGuessHeaderActions = (visible) => { id("HeaderActions").style.display = visible ? "flex" : "none"; if (!visible) clear(); else updateActions(); };
  function syncRoom(state) { if (state?.game_type !== "semantic_guess") { activeRoom = null; clear(); return; } if (state.room_id !== activeRoom || state.status === "lobby") clear(); activeRoom = state.room_id; render(); }
  function initialize() { socket.on("room:state", syncRoom); socket.on("system:error", (error) => { if (!active() || !pending) return; pending = false; pendingWord = ""; setText("Feedback", typeof error === "string" ? error : error?.message || "Could not submit. Please try again."); updateActions(); }); socket.on("disconnect", () => { pending = false; if (active()) updateActions(); }); socket.on("connect", () => { if (active()) updateActions(); }); if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState); if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "semantic_guess") window.renderSemanticGuessGameState(lastGameStatePayload); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true }); else initialize();
})();
