(() => {
  "use strict";
  const panel = document.getElementById("noThanksPanel");
  const header = document.getElementById("noThanksHeaderActions");
  const dialog = document.getElementById("noThanksDialog");
  const tooltip = document.getElementById("noThanksTooltip");
  const configBox = document.getElementById("noThanksConfigBox");
  const byId = suffix => document.getElementById(`noThanks${suffix}`);
  let view = null;
  let pending = false;
  let pendingTimer = null;
  let explaining = false;
  let suppressClick = false;
  let suppressTimer = null;
  let tipTimer = null;
  let focusBeforeDialog = null;
  let configSignature = null;
  let renderSignature = null;

  const explanations = {
    pass: ["No Thanks! · 拒收", "支付 1 枚 Chips（🔴，筹码）到当前牌上，轮到下一位玩家。没有筹码时不能拒收。"],
    take: ["Take Card · 拿牌", "拿走 Card（🃏，数字牌）和其上全部 Chips（🔴，筹码）。系统翻下一张牌，仍由你继续行动。连续数字只计最小值，筹码每枚抵 1 分。"],
    round: ["Round · 局数", "显示本局编号和总局数。每局重新洗牌并重置筹码；多局时把每局的 Net（＝，净分）累计为 Total（总分），最低总分获胜。"],
    deck: ["Deck（🂠）· 剩余牌堆", "显示尚未翻开的牌数，不包括桌面当前牌或玩家已收集的牌。数字牌为 3–35，共 33 张；每局随机暗移除 9 张，其余 24 张参与本局。最后一张牌被拿走后结算。"],
    card: ["Card（🃏）· 当前牌", "一张数字牌的数字就是罚分。牌组为 3–35，每局暗移除 9 张；所有人都不知道被移除了哪些数字。不要假定缺少的连接牌一定会出现。"],
    pot: ["Pot（🔴）· 牌上筹码", "每次有人拒收，牌上增加 1 枚 Chips（🔴，筹码）。拿牌者同时收走全部筹码，可用来继续拒收，或留到结算抵扣分数。"],
    chips: ["Chips（🔴）· 你的筹码", "拒收消耗 1 枚；拿牌补充牌上的全部筹码。3–5 人开局各 11 枚、6 人各 9 枚、7 人各 7 枚。每枚剩余筹码抵 1 分。结算前只显示你自己的数量，其他人的数量显示为 🔒。"],
    cards: ["Cards（🃏）· 牌面分", "所有 Runs（🔗，连续数字段）的最小数字之和，不是持有的牌张数。例如 13、14、15 只计 13 分；另有 17 时共计 30 分。还未减去 Chips（🔴，筹码）。"],
    runs: ["Runs（🔗）· 连续数字", "每一组连续数字只计算最小值。深色牌是计分的段首，浅色牌不额外计分。比如 13、14、15 只计 13；再有 17 时共计 30，补上 16 后合并为一段，只计 13。"],
    score: ["Net（＝）· 本局净分", "Cards（🃏，牌面分）减去剩余 Chips（🔴，筹码）。Lower is better（↓）：分数越低越好，也可以是负数。多局时将每局净分相加，最低总分获胜；并列时共同获胜。"],
    total: ["Total · 累计总分", "已经结算的各局 Net（＝，净分）之和，不包括正在进行的这一局。最后一局结束后，总分最低者获胜；并列时共同获胜。"],
    winner: ["Winner（🏆）· 获胜者", "所有局结束后 Total（累计总分）最低的玩家。分数越低越好，并列最低的玩家共同获胜。"],
    delta: ["Take change（Δ）· 拿牌净分变化", "拿牌之后的本局净分减去拿牌之前的本局净分，已经计算连续段合并和收到的筹码。例如 −12 表示你的罚分会减少 12；+6 表示会增加 6。这不是对未来牌的预测。"],
    next: ["Next Round", "确认已看完本局计分。所有玩家都确认后才重新发牌；AI 会自动确认，断线的真人仍需重连后确认。已经确认的按钮不会重复开始下一局。"],
  };
  const help = `
    <h3>目标 · 分数越低越好</h3><p>3–7 人。Cards（🃏，数字牌）带来罚分，Chips（🔴，筹码）每枚抵 1 分。Lower is better（↓）：单局结束时最低分获胜；选择多局时累计计分，并列最低共同成为 Winner（🏆，获胜者）。</p>
    <h3>准备</h3><p>数字牌为 3–35，共 33 张。随机暗移除 9 张，其余 24 张组成 Deck（🂠，牌堆）。先翻 1 张，牌堆旁的数字不包括这张当前牌。3–5 人各拿 11 枚筹码（🔴），6 人各拿 9 枚，7 人各拿 7 枚。筹码数量对其他人隐藏（🔒），结算时公开。</p>
    <h3>轮到你：拒收或拿牌</h3><p><strong>No Thanks!</strong>：支付 1 枚筹码到牌上，轮到下一位。没有筹码时不能拒收。<br><strong>Take Card</strong>：拿走当前牌及牌上全部筹码，然后翻下一张，<strong>仍由你行动</strong>。可以连续拿牌，直到选择拒收。</p>
    <p>Pot（🔴）是当前牌上累积的筹码，拿牌时全部归你。</p>
    <h3>Runs（🔗，连号）只算段首</h3><p>把公开的牌按连续数字分组，每段只计算最小数字；深色段首计分，浅色牌不额外计分。Cards（🃏）显示这些段首之和，Net（＝）显示牌面分减去剩余筹码。</p><p class="no-thanks-rule-example">🃏 8 ｜ 13·14·15 ｜ 17 → 8 + 13 + 17 = 38<br>再拿 16 → 8 ｜ 13·14·15·16·17 → 8 + 13 = 21<br>还剩 6 枚 🔴 → Net（＝）21 − 6 = 15</p>
    <p><strong>Take change（Δ）</strong> 显示现在拿牌的净分变化，包含收回筹码。绿色负数表示减分。因为 9 张牌不会出现，等一张连接牌可能落空。</p>
    <h3>本局结束与下一局</h3><p>24 张牌全部被拿走后结算。Round 显示当前局数；Total 是已结算各局净分之和。多局时所有人点击 <strong>Next Round</strong> 才继续；AI 自动确认，真人不会被自动确认。每局重新洗牌并重置筹码。最终结算会保留牌面，通过房间控制重新开始。</p>
    <h3>线上操作</h3><p>首局随机起始玩家，后续局按座位轮转。AI 只依据可见信息判断连号、筹码和竞争，不读取暗牌或他人的隐藏筹码。点击 Explain 再点牌、数值或按钮可查看解释，灰色按钮也可以解释。Esc 退出解释或关闭弹窗；电脑悬停可查看提示，手机点击后的提示在 3 秒后消失。</p>
    <p><a href="https://papmajor.dk/wp-content/uploads/mfg5715-rules-en.pdf" target="_blank" rel="noopener noreferrer">AMIGO / Mayfair rules</a> · Base game</p>`;

  function text(suffix, value) { byId(suffix).textContent = value; }
  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  function tip(node, message, key) {
    node.dataset.noThanksTip = message;
    node.tabIndex = 0;
    if (key) node.dataset.noThanksExplain = key;
    return node;
  }
  function playerName(id) { return view?.players.find(player => player.player_id === id)?.name || id || "—"; }
  function can(kind) { return !pending && view?.legal_actions.includes(kind) && socket.connected; }
  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || explaining || dialog.open) return;
    clearTimeout(tipTimer);
    tooltip.textContent = target.dataset.noThanksTip;
    tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const left = Math.max(12, Math.min(rect.left, innerWidth - box.width - 12));
    const top = rect.bottom + box.height + 18 < innerHeight ? rect.bottom + 7 : Math.max(12, rect.top - box.height - 7);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function setExplain(value) {
    explaining = value;
    panel.classList.toggle("no-thanks-explaining", value);
    byId("ExplainBtn").setAttribute("aria-pressed", String(value));
    byId("ExplainBtn").title = value ? "Choose an item to explain · Esc to exit" : "Explain";
    hideTip();
  }
  function showDialog(title, body, html = false) {
    hideTip();
    focusBeforeDialog = document.activeElement;
    text("DialogTitle", title);
    if (html) byId("DialogBody").innerHTML = body;
    else byId("DialogBody").replaceChildren(element("p", "", body));
    if (!dialog.open) dialog.showModal();
    byId("DialogClose").focus();
  }
  function explain(target) {
    const entry = explanations[target?.dataset.noThanksExplain];
    if (!entry) return;
    setExplain(false);
    showDialog(entry[0], entry[1]);
  }
  function dispatch(kind) {
    if (explaining || !can(kind)) return;
    pending = true;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; renderActions(); }, 2500);
    renderActions();
    sendAction({type: kind});
  }
  function renderActions() {
    byId("Pass").disabled = !can("pass");
    byId("Take").disabled = !can("take");
    byId("Next").disabled = !can("next_round");
    text("Next", view?.next_round_ready.includes(view.you) ? "Ready ✓" : "Next Round");
  }
  function renderPlayers() {
    const container = byId("Players");
    container.replaceChildren();
    for (const player of view.players) {
      const card = element("article", "no-thanks-player");
      card.classList.toggle("is-current", player.player_id === view.current_turn);
      card.classList.toggle("is-winner", view.winner_ids.includes(player.player_id));
      const heading = element("div", "no-thanks-player-heading");
      heading.append(element("strong", "", player.name || player.player_id));
      const badges = element("div", "no-thanks-badges");
      if (player.player_id === view.you) badges.append(element("span", "", "You"));
      if (player.is_bot) badges.append(element("span", "", "Bot"));
      if (player.player_id === view.current_turn) badges.append(element("span", "", "Turn"));
      if (view.winner_ids.includes(player.player_id)) badges.append(tip(element("span", "", "🏆"), "Winner（🏆）：累计分最低，共同最低者共享胜利。", "winner"));
      heading.append(badges);
      const scores = element("div", "no-thanks-player-scores");
      scores.append(tip(element("span", "", `🃏 ${player.card_points}`), "Cards（🃏）：各连续段最小数字之和。", "cards"));
      scores.append(tip(element("span", "", player.chips == null ? "🔴 🔒" : `🔴 ${player.chips}`), "Chips（🔴）：结算前只有玩家本人可查看；🔒 表示隐藏。", "chips"));
      if (player.net_score != null) scores.append(tip(element("span", "", `Net ${player.net_score}`), "Net（＝）：本局牌面分减去筹码。", "score"));
      if (view.total_rounds > 1) scores.append(tip(element("span", "", `Total ${player.total_score}`), "Total：已结算各局净分之和。", "total"));
      const runs = element("div", "no-thanks-runs");
      if (!player.runs.length) runs.append(element("span", "no-thanks-empty", "No cards yet"));
      for (const run of player.runs) {
        const group = tip(element("div", "no-thanks-run"), `Runs（🔗）：${run.join(" · ")} 共计 ${run[0]} 分。`, "runs");
        run.forEach(value => group.append(element("span", "", value)));
        runs.append(group);
      }
      card.append(heading, scores, runs);
      container.append(card);
    }
  }
  function renderHistory() {
    const log = byId("Log");
    const previousScroll = log.scrollTop;
    log.replaceChildren();
    const rows = [...view.history].reverse();
    if (!rows.length) log.append(element("li", "", "No moves yet."));
    rows.forEach(row => log.append(element("li", "", row.type === "pass"
      ? `${playerName(row.player_id)} passed ${row.card}. Pot: ${row.pot} 🔴.`
      : `${playerName(row.player_id)} took ${row.card} + ${row.pot} 🔴.`)));
    log.scrollTop = previousScroll;
    byId("ScoreHistory").classList.toggle("hidden", !view.score_history.length);
    const scores = byId("ScoreRows");
    scores.replaceChildren();
    view.score_history.forEach(round => {
      const row = element("div", "no-thanks-score-round");
      row.append(element("strong", "", `Round ${round.round_number}`));
      round.players.forEach(player => row.append(element("div", "", `${playerName(player.player_id)}: ${player.card_points} − ${player.chips} 🔴 = ${player.round_score} · Total ${player.total_score}`)));
      scores.append(row);
    });
  }
  function render() {
    if (!view) return;
    const own = view.players.find(player => player.player_id === view.you);
    const playing = view.phase === "playing";
    const yourTurn = playing && view.current_turn === view.you;
    text("Round", `Round ${view.round_number} / ${view.total_rounds}`);
    text("Remaining", `🂠 ${view.deck_count} left`);
    text("CardValue", view.current_card ?? "✓");
    byId("Card").classList.toggle("is-finished", !playing);
    text("Pot", view.pot);
    text("YourChips", own?.chips ?? "—");
    text("YourCards", own?.card_points ?? "—");
    text("YourNet", own?.net_score ?? "—");
    text("PersonalTitle", own ? "Your position" : "Spectating");
    text("TakeLabel", `Collect +${view.pot} 🔴`);
    text("Delta", view.take_delta == null ? "—" : `${view.take_delta > 0 ? "+" : ""}${view.take_delta}`);
    byId("Delta").className = view.take_delta <= 0 ? "no-thanks-good" : "no-thanks-cost";
    byId("Preview").classList.toggle("hidden", !own || !playing);
    if (view.game_over) {
      text("Status", "Game complete · final scores");
      text("Decision", "All 24 cards collected.");
      text("Result", `🏆 ${view.winner_ids.map(playerName).join(" & ")} ${view.winner_ids.length === 1 ? "wins" : "win"}! Lowest total: ${Math.min(...view.players.map(player => player.total_score))}.`);
    } else if (!playing) {
      text("Status", "Round complete · review the scores");
      text("Decision", "Everyone confirms before the next deal.");
      text("Result", "Card points − chips = round score. Scores are now revealed.");
    } else {
      text("Status", yourTurn ? "Your turn" : `Waiting for ${playerName(view.current_turn)}`);
      text("Decision", yourTurn ? own.chips === 0 ? "No chips left. Take this card." : "Pay a chip or collect the offer." : own ? "Your cards stay visible to everyone." : "Watching this table.");
    }
    byId("Result").classList.toggle("hidden", playing);
    byId("Review").classList.toggle("hidden", view.phase !== "round_summary");
    text("Ready", `${view.next_round_ready.length} / ${view.players.length} ready`);
    renderPlayers(); renderHistory(); renderActions();
  }

  byId("Pass").addEventListener("click", () => dispatch("pass"));
  byId("Take").addEventListener("click", () => dispatch("take"));
  byId("Next").addEventListener("click", () => dispatch("next_round"));
  byId("HelpBtn").addEventListener("click", () => { setExplain(false); showDialog("No Thanks! · Game Rules", help, true); });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  const exempt = target => target.closest("#noThanksHelpBtn, #noThanksExplainBtn, #noThanksDialog");
  document.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const direct = event.target.closest("[data-no-thanks-explain]");
    const target = direct || [...panel.querySelectorAll("[data-no-thanks-explain]")].find(node => {
      const rect = node.getBoundingClientRect();
      return rect.width && rect.height && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    suppressClick = true;
    clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => { suppressClick = false; }, 750);
    explain(target);
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    explain(event.target.closest("[data-no-thanks-explain]"));
  }, true);
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-no-thanks-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-no-thanks-tip]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-no-thanks-tip]");
    if (target) showTip(target, true); else hideTip();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.classList.contains("hidden")) { setExplain(false); hideTip(); }
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target.closest("[data-no-thanks-explain]");
    if (!target || !panel.contains(target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    explain(target);
  }, true);
  document.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", hideTip);

  function clearState() {
    view = null; pending = false; renderSignature = null; suppressClick = false;
    clearTimeout(pendingTimer); clearTimeout(suppressTimer);
    setExplain(false); hideTip();
    if (dialog.open) dialog.close();
    ["Players", "Log", "ScoreRows"].forEach(suffix => byId(suffix).replaceChildren());
    ["Result", "Review", "ScoreHistory"].forEach(suffix => byId(suffix).classList.add("hidden"));
    ["YourChips", "YourCards", "YourNet", "Delta", "Round"].forEach(suffix => text(suffix, "—"));
    text("Status", "Waiting to start"); text("CardValue", "?"); text("Pot", "0");
    text("Remaining", "🂠 — left"); text("Decision", "24 cards. Make each choice count.");
    byId("Card").classList.remove("is-finished"); renderActions();
  }
  function syncConfig(state) {
    const visible = state?.game_type === "no_thanks" && state.status === "lobby";
    configBox.classList.toggle("hidden", !visible);
    configBox.setAttribute("aria-hidden", String(!visible));
    if (state?.game_type !== "no_thanks") return;
    const signature = JSON.stringify([state.room_id, state.game_config]);
    if (signature !== configSignature) {
      byId("Rounds").value = String(state.game_config?.rounds || 1);
      configSignature = signature;
    }
    if (visible && view) clearState();
  }
  window.getNoThanksConfig = () => view && currentRoomState?.status !== "lobby" ? {...view.config} : {rounds: Number(byId("Rounds").value)};
  window.renderNoThanksGameState = data => {
    if (data?.view?.game_id !== "no_thanks" || currentGameType !== "no_thanks") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const signature = JSON.stringify([data.room_id, data.view.round_number, data.view.turn_number, data.view.next_round_ready, data.view.you]);
    if (signature !== renderSignature) { pending = false; clearTimeout(pendingTimer); hideTip(); }
    renderSignature = signature;
    view = data.view; render();
  };
  window.clearNoThanksState = clearState;
  window.showNoThanksHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) { clearState(); configBox.classList.add("hidden"); configBox.setAttribute("aria-hidden", "true"); }
    else if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
  };
  function sync() {
    socket.on("room:state", syncConfig);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); renderActions(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); renderActions(); hideTip(); });
    socket.on("connect", renderActions);
    if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "no_thanks") window.renderNoThanksGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
