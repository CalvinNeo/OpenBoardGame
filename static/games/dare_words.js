(() => {
  const GAME_ID = "dare_words";
  const id = (name) => document.getElementById(`dareWords${name}`);
  const panel = id("Panel");
  let view = null;
  let activeRoom = null;
  let pending = false;
  let selection = [];
  let explainMode = false;
  let tipTimer = null;
  let touchTipGesture = null;
  let configSignature = null;

  const ownId = () => view?.you || (typeof playerId !== "undefined" ? playerId : null);
  const active = () => typeof currentGameType === "undefined" || currentGameType === GAME_ID;
  const connected = () => typeof socket !== "undefined" && socket.connected
    && (typeof roomSessionReady === "undefined" || roomSessionReady);
  const can = (type) => connected() && !pending && Boolean(view?.legal_actions?.includes(type));
  const setText = (name, value) => { const element = id(name); if (element) element.textContent = value; };
  const node = (tag, cls, value) => {
    const element = document.createElement(tag);
    element.className = cls;
    if (value != null) element.textContent = value;
    return element;
  };
  const nameFor = (pid) => view?.players?.find((player) => player.player_id === pid)?.name || pid || "—";
  const rowCards = () => view?.row || [];
  const cardById = (cardId) => rowCards().find((card) => card.card_id === cardId);
  const minChars = () => view?.min_chars || 3;
  const isHan = (character) => /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(character);

  const explanations = {
    turn: ["当前阶段", "翻牌权按座位顺时针轮转；抢答则随时可以发起，不看回合。"],
    row: ["🀄 桌面字列", "抢答只能使用桌面上的这些字，每张字卡在一次词句里最多用一次。点字卡可以把它加进你的词句。"],
    flip: ["🀄 翻牌", "轮到你时翻 1 张字卡，它会接到桌面字列末尾，然后翻牌权交给下一位。"],
    finish: ["🏁 结束本局", "牌堆翻完后，如果桌面上再也凑不出合法词句，可以结束本局并结算分数。"],
    claim: ["🗣 抢答", "凑出至少 3 个字、只用桌面上的字的词语、短语或短句，就可以抢答。是否通顺由其他玩家投票决定。"],
    input: ["词句输入", "点桌面字卡拼词，或者直接输入。输入框会实时告诉你用字是否合法。点击面板空白处可以清空。"],
    claimBtn: ["🗣 抢答按钮", "词句合法时才能抢答。抢答后其他人会投票，认可票更多才算成功。"],
    vote: ["表决", "抢答者以外的所有玩家都要投票。认可票多于不认可票，抢答者收走用到的字卡；否则字卡留在桌上。"],
    accept: ["✅ 认可", "你认为这个词句通顺合理。"],
    reject: ["❌ 不认可", "你认为这个词句不通顺。"],
    result: ["📣 结算", "展示本轮词句、每个人的投票和得分变化。所有玩家点 Next 之后才继续。"],
    next: ["Next ▶", "确认看完结算。所有玩家都点过之后才进入下一轮。"],
    scores: ["玩家分数", "每人收走的字卡数量就是分数，🏆 表示本局获胜者，▶ 表示当前翻牌玩家。"],
  };
  const help = `<h3>🀄 胆敢造词</h3>
<p>牌堆里全是单字卡。把字翻到桌面上，谁先用桌面上的字凑出一句通顺的话，谁就把那些字卡收走。</p>
<h3>流程</h3>
<ol>
<li>翻牌权按座位顺时针轮转，轮到的人翻 1 张 🀄 字卡，接到桌面字列末尾。</li>
<li>任何人（包括翻牌的人）都可以随时 🗣 抢答：只用桌面上的字，凑出<strong>至少 3 个字</strong>的词语、短语或短句。</li>
<li>抢答者以外的所有玩家投票：✅ 认可 / ❌ 不认可。认可票更多才算成立。</li>
<li>成立：抢答者收走用到的全部字卡（1 张 1 分）；不成立：字卡留在桌上，抢答者要等桌上再翻出 1 张牌才能再次抢答。</li>
<li>结算后所有人点 <strong>Next</strong> 继续下一轮。</li>
</ol>
<h3>结束</h3>
<p>牌堆翻完且桌面剩余字不足 3 个时自动结束；也可以在牌堆已空时点 🏁 结束本局。字卡最多的玩家获胜，并列则共享胜利。</p>
<h3>图标</h3>
<p>🀄 字卡与牌堆 · 🗣 抢答 · ✅ 认可 · ❌ 不认可 · 📣 结算 · 🏁 结束本局 · 🏆 获胜 · ▶ 当前翻牌玩家 · 🤖 Bot</p>
<h3>操作提示</h3>
<p>点桌面字卡即可拼词句，手机上不需要打字；点击面板空白处清空当前选择。投票期间只显示已投人数，结算后才公开每个人的票。</p>`;

  function checkPhrase(text) {
    const characters = (text || "").replace(/\s+/g, "");
    if (!characters.length) return { ok: false, message: "" };
    if (characters.length < minChars()) return { ok: false, message: `至少 ${minChars()} 个字。` };
    for (const character of characters) {
      if (!isHan(character)) return { ok: false, message: "只能用汉字，不能加标点、字母或数字。" };
    }
    const available = new Map();
    rowCards().forEach((card) => available.set(card.char, (available.get(card.char) || 0) + 1));
    for (const character of characters) {
      const left = available.get(character) || 0;
      if (left <= 0) {
        const onTable = rowCards().some((card) => card.char === character);
        return { ok: false, message: onTable ? `「${character}」不够用。` : `「${character}」不在桌面上。` };
      }
      available.set(character, left - 1);
    }
    return { ok: true, message: `✓ ${characters.length} 个字，全部来自桌面` };
  }

  function updateConfig(state) {
    const box = id("ConfigBox");
    const select = id("DeckSelect");
    const visible = state?.game_type === GAME_ID;
    box.classList.toggle("hidden", !visible);
    box.setAttribute("aria-hidden", String(!visible));
    if (!visible) {
      configSignature = null;
      return;
    }
    const config = state.status !== "lobby" && view ? view.config || {} : state.game_config || {};
    const signature = JSON.stringify([state.room_id, config.deck_size || "full"]);
    if (signature !== configSignature) {
      select.value = config.deck_size === "short" ? "short" : "full";
      configSignature = signature;
    }
    select.disabled = !connected() || state.status !== "lobby";
  }

  function renderRow() {
    const container = id("Row");
    const cards = rowCards();
    const claimable = can("claim");
    id("RowEmpty").hidden = cards.length > 0;
    setText("RowCount", `${cards.length} 张`);
    // Rebuild only when the table itself changed. Tapping a card must keep the
    // other buttons alive so fast taps and keyboard focus are not dropped.
    const children = [...container.children];
    const sameOrder = children.length === cards.length
      && cards.every((card, index) => Number(children[index].dataset.cardId) === card.card_id);
    const existing = new Map(sameOrder ? children.map((child) => [Number(child.dataset.cardId), child]) : []);
    if (!sameOrder) container.replaceChildren();
    cards.forEach((card) => {
      let button = existing.get(card.card_id);
      if (!button) {
        button = node("button", "dare-words-card", card.char);
        button.type = "button";
        button.dataset.cardId = String(card.card_id);
        button.setAttribute("aria-label", `字卡 ${card.char}`);
        container.append(button);
      }
      const order = selection.indexOf(card.card_id);
      button.classList.toggle("is-selected", order >= 0);
      button.classList.toggle("is-order", order >= 0);
      if (order >= 0) button.dataset.order = String(order + 1);
      else delete button.dataset.order;
      button.setAttribute("aria-pressed", String(order >= 0));
      button.classList.toggle("is-locked", !claimable && order < 0);
    });
  }

  function renderStatus() {
    const phase = view?.phase;
    const flipper = view?.flipper;
    let status = "等待开始";
    if (view) {
      if (phase === "game_over") {
        const winners = (view.winner || []).map(nameFor);
        status = winners.length ? `🏆 ${winners.join("、")} 获胜` : "🏁 本局结束";
      } else if (phase === "voting") {
        status = view.claim?.is_you ? "等待大家表决…" : `${nameFor(view.claim?.player_id)} 抢答中，请表决`;
      } else if (phase === "reveal") {
        status = "结算完成，点 Next 继续";
      } else if (!view.deck_remaining) {
        status = "牌堆已空 · 只能抢答或结束本局";
      } else if (flipper === ownId()) {
        status = "轮到你翻牌 · 你也可以直接抢答";
      } else {
        status = `${nameFor(flipper)} 翻牌中 · 你可以随时抢答`;
      }
    }
    setText("Status", status);
    id("Status").parentElement.classList.toggle("is-your-turn",
      Boolean(view && view.phase === "flipping" && flipper === ownId()));
    setText("DeckCount", view ? `🀄 牌堆 ${view.deck_remaining} / ${view.deck_total}` : "🀄 牌堆 —");
  }

  function renderFlip() {
    const flip = id("FlipBtn");
    const finish = id("FinishBtn");
    flip.disabled = !can("flip");
    finish.hidden = !view?.legal_actions?.includes("finish_game");
    finish.disabled = !can("finish_game");
    let hint = "";
    if (view) {
      if (view.phase === "flipping" && view.deck_remaining) {
        hint = view.flipper === ownId() ? "轮到你翻 1 张字卡" : `等待 ${nameFor(view.flipper)} 翻牌`;
      } else if (view.phase === "flipping") {
        hint = "牌堆已空";
      }
    }
    setText("FlipHint", hint);
  }

  function renderClaim() {
    const input = id("Input");
    const button = id("ClaimBtn");
    const feedback = id("Feedback");
    const claimable = can("claim");
    const check = checkPhrase(input.value);
    input.disabled = !claimable;
    button.disabled = !claimable || !check.ok;
    button.textContent = pending ? "…" : "🗣 抢答";
    if (view && !view.legal_actions?.includes("claim") && view.phase === "flipping") {
      const me = view.players?.find((player) => player.player_id === ownId());
      feedback.classList.remove("is-ok");
      feedback.textContent = rowCards().length < minChars()
        ? `桌面不足 ${minChars()} 张字卡，先翻牌。`
        : me?.blocked ? "抢答失败后需要等桌上再翻出 1 张牌。" : "";
      return;
    }
    feedback.classList.toggle("is-ok", check.ok);
    if (!feedback.dataset.error) feedback.textContent = check.message;
  }

  function renderVote() {
    const section = id("Vote");
    const claim = view?.claim;
    section.hidden = !claim;
    if (!claim) return;
    setText("VoteName", claim.is_you ? "你" : claim.player_name);
    id("VotePhrase").textContent = claim.phrase;
    const accept = id("AcceptBtn");
    const reject = id("RejectBtn");
    const voted = claim.your_vote != null;
    accept.disabled = !can("vote");
    reject.disabled = !can("vote");
    accept.setAttribute("aria-pressed", String(claim.your_vote === true));
    reject.setAttribute("aria-pressed", String(claim.your_vote === false));
    setText("VoteProgress", claim.is_you
      ? `等待其他人表决 ${claim.votes_cast} / ${claim.votes_needed}`
      : voted
        ? `已投票 · 等待其他人 ${claim.votes_cast} / ${claim.votes_needed}`
        : `请表决 ${claim.votes_cast} / ${claim.votes_needed}`);
  }

  function renderResult() {
    const section = id("Result");
    const result = view?.last_result;
    const visible = Boolean(view && result && ["reveal", "game_over"].includes(view.phase));
    section.hidden = !visible;
    if (!visible) return;
    section.classList.toggle("is-win", Boolean(result.accepted));
    section.classList.toggle("is-lose", !result.accepted && !result.ended);
    if (result.ended) {
      setText("ResultTitle", "🏁 本局结束");
      id("ResultPhrase").textContent = "牌堆已空";
      setText("ResultScore", "");
    } else {
      setText("ResultTitle", result.accepted ? "✅ 抢答成功" : "❌ 抢答失败");
      id("ResultPhrase").textContent = `${result.player_name}：${result.phrase}`;
      setText("ResultScore", result.accepted ? `+${result.cards} 张字卡` : "字卡留在桌上");
    }
    const votes = id("ResultVotes");
    votes.replaceChildren();
    if (result.ended) {
      votes.append(node("span", "dare-words-vote-chip", "按字卡数量结算"));
    } else {
      (view.players || []).filter((player) => player.player_id !== result.player_id).forEach((player) => {
        const accepted = result.votes?.[player.player_id];
        const chip = node("span", "dare-words-vote-chip",
          `${player.name} ${accepted ? "✅" : "❌"}`);
        chip.classList.add(accepted ? "is-accept" : "is-reject");
        votes.append(chip);
      });
    }
    const next = id("NextBtn");
    const gameOver = view.phase === "game_over";
    next.textContent = gameOver ? "🔁 Play Again" : pending ? "…" : "Next ▶";
    next.disabled = gameOver ? !can("play_again") : !can("next_round");
    setText("NextHint", gameOver
      ? ""
      : `已确认 ${(view.ready || []).length} / ${(view.players || []).length}`);
  }

  function renderScoreboard() {
    const board = id("Scoreboard");
    board.replaceChildren();
    (view?.players || []).forEach((player) => {
      const chip = node("div", "dare-words-player");
      chip.classList.toggle("is-you", player.is_you);
      chip.classList.toggle("is-flipper", player.is_flipper);
      chip.classList.toggle("is-winner", Boolean(view.game_over && view.winner?.includes(player.player_id)));
      const name = node("div", "dare-words-player-name");
      const marks = [
        player.is_flipper ? "▶" : "",
        view.game_over && view.winner?.includes(player.player_id) ? "🏆" : "",
        player.is_bot ? "🤖" : "",
        player.is_you ? "You" : "",
      ].filter(Boolean).join(" ");
      name.append(node("span", "", `${marks ? marks + " " : ""}${player.name}`));
      chip.append(name, node("span", "dare-words-player-score", String(player.score)));
      board.append(chip);
    });
  }

  function renderHistory() {
    const list = id("History");
    const entries = (view?.history || []).slice().reverse();
    list.replaceChildren();
    setText("HistoryCount", String(entries.length));
    if (!entries.length) {
      list.append(node("div", "dare-words-history-empty", "还没有抢答记录。"));
      return;
    }
    entries.forEach((entry) => {
      const row = node("div", "dare-words-history-row");
      row.append(
        node("span", "dare-words-history-mark", entry.ended ? "🏁" : entry.accepted ? "✅" : "❌"),
        node("span", "dare-words-history-phrase", entry.ended ? "本局结束" : entry.phrase),
        node("span", "dare-words-history-meta",
          entry.ended ? entry.player_name : `${entry.player_name} · ${entry.accepted ? "+" + entry.cards : "0"}`),
      );
      list.append(row);
    });
  }

  function render() {
    updateConfig(typeof currentRoomState === "undefined" ? null : currentRoomState);
    renderStatus();
    renderRow();
    renderFlip();
    renderClaim();
    renderVote();
    renderResult();
    renderScoreboard();
    renderHistory();
  }

  function clearSelection() {
    selection = [];
    id("Input").value = "";
    id("Feedback").dataset.error = "";
    id("Feedback").textContent = "";
  }

  function send(type, extra = {}) {
    if (!view || !can(type)) return;
    pending = true;
    id("Feedback").dataset.error = "";
    render();
    sendAction({ type, game_token: view.game_token, window_id: view.window_id, ...extra });
  }

  function submitClaim() {
    const phrase = id("Input").value.replace(/\s+/g, "");
    if (!checkPhrase(phrase).ok) return;
    send("claim", { phrase });
  }

  function showDialog(title, content, html = false) {
    setExplain(false);
    setText("DialogTitle", title);
    const target = id("DialogContent");
    if (html) target.innerHTML = content;
    else target.replaceChildren(node("p", "", content));
    const dialog = id("Dialog");
    if (!dialog.open) dialog.showModal();
    id("DialogCloseBtn").focus({ preventScroll: true });
  }

  function setExplain(enabled) {
    explainMode = enabled;
    panel.classList.toggle("dare-words-explain-mode", enabled);
    id("ExplainBtn").setAttribute("aria-pressed", String(enabled));
    hideTip();
  }

  function hideTip() {
    clearTimeout(tipTimer);
    id("Tooltip").hidden = true;
  }

  function showTip(target) {
    hideTip();
    if (!target?.dataset.dwTip || explainMode) return;
    const tip = id("Tooltip");
    tip.textContent = target.dataset.dwTip;
    tip.hidden = false;
    const rect = target.getBoundingClientRect();
    tip.style.left = `${Math.max(12, Math.min(innerWidth - tip.offsetWidth - 12, rect.left))}px`;
    tip.style.top = `${Math.max(12, Math.min(innerHeight - tip.offsetHeight - 12, rect.bottom + 8))}px`;
    tipTimer = setTimeout(hideTip, 3000);
  }

  function explainAt(target) {
    const info = explanations[target?.dataset?.dwExplain];
    if (!info) return false;
    showDialog(...info);
    return true;
  }

  id("Row").addEventListener("click", (event) => {
    const button = event.target.closest(".dare-words-card");
    if (!button || explainMode) return;
    const cardId = Number(button.dataset.cardId);
    if (!can("claim")) return;
    const index = selection.indexOf(cardId);
    if (index >= 0) selection.splice(index, 1);
    else if (cardById(cardId)) selection.push(cardId);
    id("Input").value = selection.map((value) => cardById(value)?.char || "").join("");
    id("Feedback").dataset.error = "";
    renderRow();
    renderClaim();
  });

  id("Input").addEventListener("input", () => {
    selection = [];
    id("Feedback").dataset.error = "";
    renderRow();
    renderClaim();
  });
  id("Input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); submitClaim(); }
  });
  id("FlipBtn").addEventListener("click", () => send("flip"));
  id("FinishBtn").addEventListener("click", () => send("finish_game"));
  id("ClaimBtn").addEventListener("click", submitClaim);
  id("AcceptBtn").addEventListener("click", () => send("vote", { accept: true }));
  id("RejectBtn").addEventListener("click", () => send("vote", { accept: false }));
  id("NextBtn").addEventListener("click", () => send(view?.phase === "game_over" ? "play_again" : "next_round"));
  id("HelpBtn").addEventListener("click", () => showDialog("胆敢造词 · Help", help, true));
  id("ExplainBtn").addEventListener("click", () => setExplain(!explainMode));
  id("DialogCloseBtn").addEventListener("click", () => id("Dialog").close());
  id("DeckSelect").addEventListener("change", () => {
    if (typeof updateRoomActionButtons === "function") updateRoomActionButtons();
  });

  panel.addEventListener("click", (event) => {
    if (explainMode) return;
    if (event.target.closest("button, input, label, summary, details, a")) return;
    if (!selection.length && !id("Input").value) return;
    clearSelection();
    renderRow();
    renderClaim();
  });

  panel.addEventListener("pointerdown", (event) => {
    if (!explainMode) return;
    const target = event.target.closest?.("[data-dw-explain]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    explainAt(target);
  }, true);
  panel.addEventListener("pointerover", (event) => {
    if (event.pointerType === "mouse") showTip(event.target.closest("[data-dw-tip]"));
  });
  panel.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || explainMode) return;
    touchTipGesture = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      target: event.target.closest("[data-dw-tip]"), started: performance.now(), moved: false,
    };
    hideTip();
  });
  document.addEventListener("pointermove", (event) => {
    if (touchTipGesture?.pointerId === event.pointerId
        && Math.hypot(event.clientX - touchTipGesture.x, event.clientY - touchTipGesture.y) > 8) {
      touchTipGesture.moved = true;
    }
  });
  document.addEventListener("pointerup", (event) => {
    const gesture = touchTipGesture;
    touchTipGesture = null;
    if (event.pointerType === "mouse" || !gesture || gesture.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    if (!gesture.moved && moved <= 8 && performance.now() - gesture.started <= 600
        && gesture.target && gesture.target === event.target.closest("[data-dw-tip]")) {
      showTip(gesture.target);
    }
  });
  document.addEventListener("pointercancel", () => { touchTipGesture = null; });
  panel.addEventListener("pointerout", (event) => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", (event) => { if (!touchTipGesture) showTip(event.target.closest("[data-dw-tip]")); });
  panel.addEventListener("focusout", hideTip);
  document.addEventListener("scroll", () => {
    if (touchTipGesture) touchTipGesture.moved = true;
    hideTip();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!active()) return;
    if (event.key === "Escape") {
      setExplain(false);
      if (id("Dialog").open) id("Dialog").close();
    }
    if (explainMode && event.key === "Enter") {
      const target = event.target.closest?.("[data-dw-explain]");
      if (target && explainAt(target)) event.preventDefault();
    }
  });
  document.addEventListener("click", (event) => {
    if (!active() || !explainMode) return;
    if (event.target.closest("#dareWordsHelpBtn,#dareWordsExplainBtn,#dareWordsDialogCloseBtn")) return;
    const target = event.target.closest("[data-dw-explain]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    explainAt(target);
  }, true);

  window.getDareWordsConfig = () => ({ deck_size: id("DeckSelect").value === "short" ? "short" : "full" });
  window.renderDareWordsGameState = (data) => {
    if (!active()) return;
    if (data?.game_type && data.game_type !== GAME_ID) return;
    if (data?.room_id && data.room_id !== currentRoomState?.room_id) return;
    const next = data?.view || data;
    if (!next || (next.game_id && next.game_id !== GAME_ID)) return;
    const previousPhase = view?.phase;
    view = next;
    pending = false;
    if (previousPhase !== view.phase) clearSelection();
    selection = selection.filter((cardId) => Boolean(cardById(cardId)));
    if (selection.length) id("Input").value = selection.map((value) => cardById(value).char).join("");
    render();
  };
  window.showDareWordsHeaderActions = (visible) => {
    id("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) {
      view = null;
      pending = false;
      clearSelection();
      if (id("Dialog").open) id("Dialog").close();
      setExplain(false);
    }
    render();
  };

  function syncRoom(state) {
    if (state?.game_type !== GAME_ID) {
      activeRoom = null;
      updateConfig(state);
      view = null;
      clearSelection();
      render();
      return;
    }
    if (state.room_id !== activeRoom || state.status === "lobby") {
      view = null;
      clearSelection();
    }
    activeRoom = state.room_id;
    updateConfig(state);
    render();
  }

  function initialize() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", (error) => {
      if (!active() || !pending) return;
      pending = false;
      const message = typeof error === "string" ? error : error?.message || "操作失败，请重试。";
      const feedback = id("Feedback");
      feedback.dataset.error = "1";
      feedback.classList.remove("is-ok");
      feedback.textContent = message;
      render();
    });
    socket.on("disconnect", () => { pending = false; if (active()) render(); });
    socket.on("connect", () => { if (active()) render(); });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === GAME_ID) {
      window.renderDareWordsGameState(lastGameStatePayload);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
