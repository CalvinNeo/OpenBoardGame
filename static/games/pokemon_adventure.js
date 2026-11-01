(() => {
  "use strict";

  const byId = suffix => document.getElementById(`pokemonAdventure${suffix}`);
  const panel = byId("Panel");
  const dialog = byId("Dialog");
  const tooltip = byId("Tooltip");
  const abilityLabels = {charizard: "窥视", snorlax: "交换", zapdos: "传递", mew: "夺取", ditto: "复制", rocket: "投币", team_rocket: "投币"};
  const cardColors = {pink: "#f2dae5", brown: "#e6d6ba", yellow: "#f2e6ac", green: "#d1e8ca", blue: "#cfe3ed", orange: "#f2d7b4", purple: "#ded5ee", gray: "#dedfd7"};
  const explanations = {
    deck: ["牌库", "从牌库抽一张，只有你能看见。通常可换入自己的一个位置，或弃掉抽牌。闪电鸟、梦幻、火箭队必须使用。"],
    discard: ["弃牌堆", "拿走公开的弃牌堆顶牌。这张牌必须使用，不能再直接弃掉。主动使用特殊牌时会发动能力。"],
    drawn: ["你的抽牌", "抽到的牌在这里显示，其他玩家看不见从牌库抽的牌。点自己的一个位置并在原地确认换入。"],
    discard_drawn: ["弃掉抽牌", "弃掉刚从牌库抽到的可选牌，然后结束回合。来自弃牌堆的牌及闪电鸟、梦幻、火箭队不能这样弃掉。"],
    skip: ["跳过能力", "可以跳过喷火龙的窥视或卡比兽的交换。跳过后保留刚换入的特殊牌，结束当前回合。"],
    next_round: ["Next Round", "确认已经看完这一小局的结果。所有真人确认后开始下一小局，机器人自动确认。此操作不再弹出确认。"],
    tokens: ["精灵球代币（🔴）", "每小局最低分者得到一枚代币。先达到本场目标数量的训练家获胜。"],
    columns: ["按列计分", "上排与下排在同一列的有效数字相同，这列记 0 分；不同则两数相加。三列合计，分数越低越好。"],
  };
  let view = null;
  let signature = null;
  let selection = {};
  let pending = false;
  let pendingTimer = null;
  let explaining = false;
  let tipTimer = null;
  let tipAnchor = null;
  let gesture = null;
  let explainGesture = null;
  let suppressClickUntil = 0;
  let returnFocus = null;

  const active = () => panel && !panel.classList.contains("hidden") && (typeof currentGameType === "undefined" || currentGameType === "pokemon_adventure");
  const players = () => Array.isArray(view?.players) ? view.players : [];
  const ownPlayer = () => players().find(player => player.player_id === view?.you);
  const playerName = id => players().find(player => player.player_id === id)?.name || "Trainer";
  const connected = () => typeof socket === "undefined" || socket.connected;
  const can = type => !pending && connected() && !!view?.legal_actions?.includes(type);
  const slotLabel = slot => `${slot < 3 ? "上" : "下"}${slot % 3 + 1}`;
  const cardName = card => card?.name_zh || card?.name || card?.species || "宝可梦";
  const ownDittoChoices = () => (view?.ditto_choices || []).filter(choice => choice.player_id === view?.you);

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined && content !== null) node.textContent = content;
    return node;
  }
  function text(suffix, content) { byId(suffix).textContent = content; }
  function feedback(message = "") { text("Feedback", message); byId("Feedback").classList.toggle("hidden", !message); }
  function resetSelection() { selection = {}; }
  function cardDescription(card) {
    if (!card) return "暗牌，身份尚未公开。";
    const ability = {charizard: "入场后可窥视自己一张暗牌，其他人看不到。", snorlax: "入场后可交换自己的两个位置，朝向随牌移动。", zapdos: "必须使用；选同一位置沿回合顺序传递，每人的新牌都公开，末张旧牌放弃牌堆底。", mew: "必须使用；选择对手一张明牌，将梦幻放到该位置，把夺到的明牌换入自己。", ditto: "结算时复制左右相邻牌的数字；边缘位置自动复制唯一邻居。", rocket: "必须使用；投币决定正常换入，或让全员同位置弃牌并补牌。", team_rocket: "必须使用；投币决定正常换入，或让全员同位置弃牌并补牌。"};
    return `${cardName(card)}（${card.emoji || "⭐"}），${card.value} 分。${ability[card.ability] || "普通牌；争取让同列上下数字相等，消去这一列的分数。"}`;
  }

  function paintCard(node, item, position = null) {
    const card = item?.card || null;
    node.replaceChildren();
    node.classList.toggle("pa-back", !card);
    node.classList.remove("pa-empty");
    node.classList.toggle("private", !!card && item?.face_up === false);
    node.style.removeProperty("--pa-card-color");
    node.dataset.paTip = cardDescription(card);
    node.dataset.paExplain = "card";
    if (!card) {
      node.append(element("span", "pa-back-ball"), element("span", "pa-back-label", position === null ? "牌背" : slotLabel(position)));
      node.setAttribute("aria-label", `${position === null ? "" : `${slotLabel(position)}，`}暗牌`);
      return;
    }
    if (cardColors[card.color]) node.style.setProperty("--pa-card-color", cardColors[card.color]);
    const heading = element("span", "pa-card-head");
    heading.append(element("span", "pa-card-value", card.effective_value ?? card.value), element("span", "pa-card-position", position === null ? "" : slotLabel(position)));
    const footer = element("span", "pa-card-footer");
    footer.append(element("span", "pa-card-name", cardName(card)));
    const abilityText = card.ability === "ditto" && card.effective_value !== undefined ? `复制 → ${card.effective_value}` : abilityLabels[card.ability] || "普通牌";
    footer.append(element("span", item?.face_up === false ? "pa-card-ability pa-private-mark" : "pa-card-ability", item?.face_up === false ? "🔒 仅你可见" : abilityText));
    node.append(heading, element("span", "pa-card-emoji", card.emoji || "⭐"), footer);
    node.setAttribute("aria-label", `${position === null ? "" : `${slotLabel(position)}，`}${cardDescription(card)}${item?.face_up === false ? " 这是你记住的暗牌。" : ""}`);
  }

  function selectable(playerId, slot) {
    if (!view || pending || !connected()) return false;
    if (playerId !== view.you) return can("steal_card") && !!players().find(player => player.player_id === playerId)?.hand?.[slot]?.face_up;
    if (can("initial_reveal")) return !ownPlayer()?.hand?.[slot]?.face_up;
    if (can("replace_card")) return true;
    if (can("peek_card")) return (view.pending_ability?.slots || []).includes(slot);
    if (can("swap_cards")) return (view.pending_ability?.slots || [0, 1, 2, 3, 4, 5]).includes(slot);
    if (can("steal_card")) return !!selection.target;
    if (can("choose_ditto")) {
      const choice = ownDittoChoices().find(entry => entry.slot === selection.dittoSlot);
      return ownDittoChoices().some(entry => entry.slot === slot) || !!choice?.neighbors?.includes(slot);
    }
    return false;
  }

  function selectSlot(playerId, slot) {
    if (explaining || !selectable(playerId, slot)) return;
    hideTip();
    if (playerId !== view.you) selection = {target: {playerId, slot}};
    else if (can("swap_cards")) {
      const previous = selection.swapSlots || [];
      selection.swapSlots = previous.includes(slot) ? previous.filter(value => value !== slot) : [...previous.slice(-1), slot];
    } else if (can("choose_ditto")) {
      const choice = ownDittoChoices().find(entry => entry.slot === selection.dittoSlot);
      if (choice?.neighbors?.includes(slot)) selection.neighborSlot = slot;
      else { selection.dittoSlot = slot; delete selection.neighborSlot; }
    } else selection.slot = selection.slot === slot ? undefined : slot;
    renderTable();
    renderActions();
  }

  function confirmationFor(playerId, slot) {
    if (playerId !== view?.you) return null;
    if (can("swap_cards") && selection.swapSlots?.length === 2 && selection.swapSlots[1] === slot) return {label: "确认交换", action: {type: "swap_cards", slots: selection.swapSlots}};
    if (can("choose_ditto") && selection.neighborSlot === slot) return {label: "复制此值", action: {type: "choose_ditto", slot: selection.dittoSlot, neighbor_slot: slot}};
    if (selection.slot !== slot) return null;
    if (can("initial_reveal")) return {label: "翻开此牌", action: {type: "initial_reveal", slot}};
    if (can("replace_card")) return {label: "确认换入", action: {type: "replace_card", slot}};
    if (can("peek_card")) return {label: "窥视此牌", action: {type: "peek_card", slot}};
    if (can("steal_card") && selection.target) return {label: "夺取并换入", action: {type: "steal_card", target_player_id: selection.target.playerId, target_slot: selection.target.slot, slot}};
    return null;
  }

  function handCard(player, item, slot) {
    const wrapper = element("div", "pa-slot");
    const button = element("button", "pa-card");
    button.type = "button";
    button.dataset.paPlayer = player.player_id;
    button.dataset.paSlot = slot;
    paintCard(button, item, slot);
    button.classList.toggle("selectable", selectable(player.player_id, slot));
    button.setAttribute("aria-disabled", String(!selectable(player.player_id, slot)));
    const selected = player.player_id === view.you
      ? selection.slot === slot || selection.swapSlots?.includes(slot) || selection.dittoSlot === slot || selection.neighborSlot === slot
      : selection.target?.playerId === player.player_id && selection.target.slot === slot;
    button.classList.toggle("selected", !!selected);
    button.setAttribute("aria-pressed", String(!!selected));
    wrapper.append(button);
    const confirmation = confirmationFor(player.player_id, slot);
    if (confirmation) {
      const confirmButton = element("button", "pa-slot-confirm pa-primary", confirmation.label);
      confirmButton.type = "button";
      confirmButton.dataset.paExplain = "confirm";
      confirmButton.dataset.paTip = "确认对选中的位置执行当前行动。点击周围空白或按 Esc 可以取消选择。";
      confirmButton.addEventListener("click", () => dispatch(confirmation.action));
      wrapper.append(confirmButton);
    }
    return wrapper;
  }

  function renderTable() {
    const own = ownPlayer();
    text("YouName", own ? `${own.name} · 你的六牌` : "Spectating");
    text("Tokens", own ? `🔴 ${own.tokens || 0} / ${view?.config?.target_tokens || 3}` : "");
    byId("Tokens").dataset.paExplain = "tokens";
    byId("Tokens").dataset.paTip = explanations.tokens[1];
    byId("Tokens").tabIndex = 0;
    const hand = byId("Hand");
    hand.replaceChildren();
    if (own) (own.hand || []).forEach((item, slot) => hand.append(handCard(own, item, slot)));
    else hand.append(element("p", "pa-observer-note", "观看其他训练家的六牌桌面。"));
    const columnScores = byId("Columns");
    columnScores.replaceChildren();
    const ownSummary = view?.phase === "round_end" ? view?.last_round_summary?.players?.find(player => player.player_id === view.you) : null;
    if (ownSummary?.columns) ownSummary.columns.forEach((score, index) => {
      const label = element("span", "", `第 ${index + 1} 列：${typeof score === "object" ? score.score : score} 分`);
      label.dataset.paExplain = "columns";
      label.dataset.paTip = explanations.columns[1];
      label.tabIndex = 0;
      columnScores.append(label);
    });
    const others = players().filter(player => player.player_id !== view?.you);
    text("PlayerCount", `${players().length} 人`);
    const opponents = byId("Players");
    opponents.replaceChildren();
    others.forEach(player => {
      const article = element("article", "pa-opponent");
      article.classList.toggle("acting", player.player_id === view.current_turn && view.phase !== "round_end");
      const heading = element("div", "pa-opponent-head");
      heading.append(element("strong", "", `${player.player_id === view.current_turn && view.phase !== "round_end" ? "▶ " : ""}${player.name}`), element("span", "", `🔴 ${player.tokens || 0}`));
      const otherHand = element("div", "pa-hand");
      (player.hand || []).forEach((item, slot) => otherHand.append(handCard(player, item, slot)));
      const meta = element("div", "pa-opponent-meta");
      meta.append(element("span", "", `已公开 ${player.revealed_count ?? player.hand?.filter(item => item.face_up).length ?? 0}/6`));
      if (view.phase === "initial_reveal") meta.append(element("span", "", player.initial_reveal_done ? "已翻牌 ✓" : "选择首张"));
      if (view.phase === "round_end") meta.append(element("span", "", `${player.round_score ?? "—"} 分${player.round_ready ? " · Ready ✓" : ""}`));
      article.append(heading, otherHand, meta);
      opponents.append(article);
    });
  }

  function prompt() {
    if (!view) return ["Waiting for the game state.", ""];
    if (pending) return ["Submitting…", "等待服务器更新。"];
    if (!connected()) return ["Disconnected", "Reconnecting…"];
    if (view.game_over) return ["整场结束", "可在 Room Controls 中开始新一场。"];
    if (can("initial_reveal")) return ["翻开你的第一张牌", "点选一个位置，再在牌旁确认。"];
    if (view.phase === "initial_reveal") return ["等待所有训练家翻牌", "你已公开第一张牌。"];
    if (view.phase === "round_end") return ["查看本局结果", ownPlayer()?.round_ready ? "Ready ✓ · 等待其他训练家。" : "查看牌面后点击 Next Round。"];
    if (can("choose_ditto")) return ["选择百变怪复制的数字", selection.dittoSlot !== undefined ? "点选同一排左侧或右侧的邻居，再原地确认。" : "点选需要决定的百变怪。"];
    if (can("peek_card")) return ["🔥 喷火龙 · 窥视", "点选自己一张暗牌。结果仅你可见，也可跳过。"];
    if (can("swap_cards")) return ["💤 卡比兽 · 交换", selection.swapSlots?.length === 1 ? `已选${slotLabel(selection.swapSlots[0])}，再选择第二个位置。` : "点选自己两个位置，朝向随牌移动。"];
    if (can("steal_card")) return ["✨ 梦幻 · 夺取", selection.target ? `已选 ${playerName(selection.target.playerId)} 的${slotLabel(selection.target.slot)}，再选自己的接收位置。` : "先选对手的一张明牌，再选自己的接收位置。"];
    if (can("replace_card")) return ["选择换入的位置", view.drawn?.card?.ability === "zapdos" ? "⚡ 闪电鸟将沿顺序传递此位置的旧牌。" : ["rocket", "team_rocket"].includes(view.drawn?.card?.ability) ? "投币后，正常换入或重置所有人同一位置。" : "点选自己的牌并原地确认；可弃抽牌时也可直接弃掉。"];
    if (can("draw_deck") || can("draw_discard")) return ["从牌库或弃牌堆抽一张", "换入低分牌，或让上下同列的数字相同。"];
    return [`${playerName(view.current_turn)} 正在行动`, "公开牌与行动日志会随操作更新。"];
  }

  function renderActions() {
    const [main, note] = prompt();
    text("Prompt", main);
    text("ActionNote", note);
    text("Round", view ? `第 ${view.round} 局` : "");
    const phases = {initial_reveal: "首张翻牌", turn: "抽牌", drawn: "选择换牌", ability: "特殊能力", ditto_choice: "百变怪结算", round_end: "小局结算"};
    text("Phase", phases[view?.phase] || "");
    text("Turn", view?.game_over ? "🏆 整场结束" : view?.legal_actions?.length ? "轮到你行动" : view ? `${playerName(view.current_turn)} 的回合` : "Waiting to start");
    const needsAction = !!view?.legal_actions?.length && !view.game_over;
    byId("Status").classList.toggle("your-turn", needsAction);
    document.body.classList.toggle("pa-your-turn", active() && needsAction);
    byId("DrawDeckBtn").disabled = !can("draw_deck");
    byId("DrawDiscardBtn").disabled = !can("draw_discard");
    byId("DiscardBtn").disabled = !can("discard_drawn");
    byId("DiscardBtn").classList.toggle("hidden", !["turn", "drawn"].includes(view?.phase));
    byId("Piles").classList.toggle("hidden", !["turn", "drawn"].includes(view?.phase));
    byId("SkipBtn").disabled = !can("skip_ability");
    byId("SkipBtn").classList.toggle("hidden", !view?.pending_ability);
    byId("NextRoundBtn").classList.toggle("hidden", view?.phase !== "round_end" || !!view?.game_over);
    byId("Review").classList.toggle("hidden", view?.phase !== "round_end" || !!view?.game_over);
    byId("NextRoundBtn").disabled = !can("next_round");
    text("NextRoundBtn", ownPlayer()?.round_ready ? "Ready ✓" : "Next Round");
    text("DeckCount", view ? `· ${view.deck_count} 张` : "");
    if (view?.discard_top) paintCard(byId("DrawDiscardBtn"), {card: view.discard_top, face_up: true});
    else { byId("DrawDiscardBtn").replaceChildren(element("span", "", "暂无弃牌")); byId("DrawDiscardBtn").classList.add("pa-empty"); }
    byId("DrawDiscardBtn").dataset.paExplain = "discard";
    if (view?.drawn && view.drawn.player_id === view.you && view.drawn.card) paintCard(byId("Drawn"), {card: view.drawn.card, face_up: true});
    else if (view?.drawn) paintCard(byId("Drawn"), {card: null});
    else { byId("Drawn").replaceChildren(element("span", "", "尚未抽牌")); byId("Drawn").className = "pa-card pa-empty"; }
    byId("Drawn").dataset.paExplain = "drawn";
    renderChoice();
  }

  function renderChoice() {
    const box = byId("Choice");
    box.replaceChildren();
    const choice = ownDittoChoices().find(entry => entry.slot === selection.dittoSlot);
    box.classList.toggle("hidden", !can("choose_ditto"));
    if (!can("choose_ditto")) return;
    box.append(element("strong", "", choice ? `${slotLabel(choice.slot)} 百变怪：复制哪一张？` : "结算前，为百变怪选择相邻数字。"));
    const controls = element("div", "pa-choice-controls");
    if (choice) choice.neighbors.forEach(neighborSlot => {
      const card = ownPlayer()?.hand?.[neighborSlot]?.card;
      const button = element("button", "", `${slotLabel(neighborSlot)} · ${cardName(card)} ${card?.value ?? "?"}`);
      button.type = "button";
      button.dataset.paExplain = "ditto";
      button.dataset.paTip = "点选这个邻居后，在对应卡牌旁确认复制。";
      button.addEventListener("click", () => { selection.neighborSlot = neighborSlot; renderTable(); });
      controls.append(button);
    });
    else ownDittoChoices().forEach(entry => {
      const button = element("button", "", `${slotLabel(entry.slot)} 百变怪`);
      button.type = "button";
      button.dataset.paExplain = "ditto";
      button.dataset.paTip = "选择此百变怪，再决定复制同排左侧还是右侧的邻居。";
      button.addEventListener("click", () => { selection.dittoSlot = entry.slot; renderTable(); renderChoice(); });
      controls.append(button);
    });
    box.append(controls);
  }

  function renderResult() {
    const result = byId("Result");
    const summary = view?.last_round_summary;
    const visible = view?.phase === "round_end" && !!summary;
    result.classList.toggle("hidden", !visible);
    result.replaceChildren();
    if (!visible) return;
    const winners = view.game_over ? view.winner || [] : summary.winner ? [summary.winner] : [];
    const names = winners.map(playerName).join("、");
    result.append(element("h3", "", view.game_over ? `🏆 ${names || "训练家"} 获得整场胜利` : `第 ${summary.round} 局 · ${names || "结算完成"}${names ? " 获得 🔴" : ""}`));
    (summary.players || []).forEach(player => {
      const row = element("div", `pa-result-row${player.player_id === view.you ? " own" : ""}`);
      row.append(element("span", "", `${player.player_id === view.you ? "你 · " : ""}${player.name || playerName(player.player_id)}`), element("span", "", `${player.score} 分`), element("span", "", `🔴 ${player.tokens ?? players().find(entry => entry.player_id === player.player_id)?.tokens ?? 0}`));
      result.append(row);
    });
    if (summary.tie_break) result.append(element("p", "", typeof summary.tie_break === "string" ? summary.tie_break : "同分比较降序有效数字，较高者胜；仍相同按座位顺序决定。"));
    const me = (summary.players || []).find(player => player.player_id === view.you);
    if (me?.columns) result.append(element("p", "", `你的三列：${me.columns.map(score => typeof score === "object" ? score.score : score).join(" + ")} = ${me.score} 分`));
    if (!view.game_over) result.append(element("p", "", "牌面保留供所有人查看。每人点击 Next Round 后继续。"));
  }

  function renderLog() {
    const entries = Array.isArray(view?.log) ? view.log : [];
    const list = byId("Log");
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 20;
    list.replaceChildren();
    entries.slice(-60).forEach(entry => list.append(element("li", "", typeof entry === "string" ? entry : entry.text || entry.message || "行动已完成")));
    text("LogCount", entries.length ? `· ${entries.length}` : "");
    if (atBottom) list.scrollTop = list.scrollHeight;
  }

  function render() { renderTable(); renderActions(); renderResult(); renderLog(); }

  function dispatch(action) {
    if (explaining || !can(action.type) || typeof sendAction !== "function") return;
    hideTip(); feedback(); pending = true;
    resetSelection();
    renderTable(); renderActions();
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; if (active()) render(); }, 5000);
    sendAction(action);
  }

  function hideTip() { clearTimeout(tipTimer); tipAnchor = null; tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || explaining || dialog.open || !active()) return;
    const message = target.dataset.paTip;
    if (!message) return;
    clearTimeout(tipTimer);
    tipAnchor = target;
    tooltip.textContent = message;
    tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(10, Math.min(innerWidth - box.width - 10, rect.left))}px`;
    tooltip.style.top = `${Math.max(10, Math.min(innerHeight - box.height - 10, rect.bottom + 7))}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function setExplain(enabled) {
    explaining = enabled;
    hideTip();
    document.body.classList.toggle("pa-explaining", enabled);
    byId("ExplainBtn").setAttribute("aria-pressed", String(enabled));
    byId("ExplainHint").classList.toggle("hidden", !enabled);
  }
  function openDialog(title, content, html = false) {
    hideTip();
    returnFocus = document.activeElement;
    text("DialogTitle", title);
    if (html) byId("DialogBody").innerHTML = content;
    else byId("DialogBody").replaceChildren(element("p", "", content));
    if (!dialog.open) dialog.showModal();
    byId("DialogClose").focus({preventScroll: true});
  }
  function explain(target) {
    const entry = explanations[target.dataset.paExplain];
    const message = entry || [target.dataset.paExplain === "card" ? "宝可梦卡牌" : "Explain", target.dataset.paTip || "选择牌后在附近确认。点击周围空白或按 Esc 可以取消选择。"];
    setExplain(false);
    openDialog(message[0], message[1]);
  }

  const help = `<h3>六张牌，分数越低越好</h3>
    <p>每人面前有上、下两排各三张牌。开局从六张暗牌中选一张公开。先获得 3 枚精灵球代币（🔴）的训练家赢得整场。</p>
    <h3>你的回合</h3>
    <p>从牌库（牌背）或弃牌堆顶抽一张。选择自己的一个位置，把抽牌公开换入，旧牌公开弃掉。从牌库抽的普通牌可直接弃掉；从弃牌堆拿的牌必须使用。点选位置后在牌旁确认，点击周围空白或按 Esc 取消选择。</p>
    <h3>六种能力</h3>
    <table><thead><tr><th>卡牌</th><th>能力</th></tr></thead><tbody>
    <tr><td>🔥 喷火龙 · 10</td><td>换入后，可窥视自己一张暗牌，仍只有自己知道；也可跳过。</td></tr>
    <tr><td>💤 卡比兽 · 10</td><td>换入后，可交换自己任意两个位置；公开状态随牌，也可跳过。</td></tr>
    <tr><td>⚡ 闪电鸟 · 10</td><td>必须使用。选择一个位置，沿回合顺序传递该位置的旧牌，所有换入牌公开，最后一张放到弃牌堆底。</td></tr>
    <tr><td>✨ 梦幻 · 2</td><td>必须使用。先选对手的一张明牌，再选自己的接收位置：梦幻放入对手位置，夺到的牌公开换入自己，自己的旧牌弃掉。</td></tr>
    <tr><td>🟣 百变怪 · 0</td><td>结算时复制同一排左或右相邻牌的数字。边缘自动选唯一邻居；中间由持有者选择。相互复制形成的环按 0 处理。</td></tr>
    <tr><td>🚀 火箭队 · 12</td><td>必须使用。选自己的一个位置后投币：喵喵面正常换入；皮卡丘面将全员该位置的旧牌放弃牌堆底，弃掉火箭队，再从当前玩家起依次补入公开新牌。</td></tr>
    </tbody></table><p>只有主动抽到并使用的特殊牌发动能力。开局翻牌、被传递、被梦幻夺取或补入的新牌不连锁触发。</p>
    <h3>小局结束与计分</h3><p>当前行动及能力全部结算后，只要有人六张牌全公开，所有人翻开余牌并结算。上、下同列数字相同记 0（两张 −2 也记 0），否则相加；三列总分最低者得到一枚 🔴。同分比较降序排列的有效数字，首个不同数字较高者胜；仍完全相同按座位顺序决定。牌库空时保留弃牌顶，将其余弃牌洗回；无法抽牌则结算。</p>
    <p>百变怪需要选择时，先完成选择再显示分数。结果与所有牌面会保留，所有真人点击 <strong>Next Round</strong> 后再发牌，机器人自动确认。后续小局由前局胜者先手。最终整场结束后可从 Room Controls 重新开始。</p>
    <h3>线上操作</h3><p>绿色描边表示当前可选位置，金色表示已选。🔒 表示自己记住的暗牌，别人仍看不到。Log 默认折叠。Explain 可以解释灰色按钮；解释模式不会执行游戏行动。Esc 关闭对话框或退出解释。电脑悬停可查看静态图标提示，手机轻触提示在 3 秒后消失。</p>
    <h3>版本与边界约定</h3><p>采用 56 张、六能力的宝可梦版，核心规则与 Mandoo 原版规则书交叉核对。完全相同的平局按座位、百变怪递归复制且循环按 0、能力可跳过、重洗保留弃牌顶属于本项目明确约定。宝可梦版能力参考 <a href="https://boardgamegeek.com/thread/3349400/quick-summary-of-english-rules-for-pokemon-safari" target="_blank" rel="noopener noreferrer">韩版英文规则摘要</a>；卡面由 CSS 与 Emoji 绘制。</p>`;

  byId("HelpBtn").addEventListener("click", () => { setExplain(false); openDialog("宝可梦奇遇 · Help", help, true); });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { returnFocus?.focus?.({preventScroll: true}); returnFocus = null; });
  dialog.addEventListener("click", event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  byId("DrawDeckBtn").addEventListener("click", () => dispatch({type: "draw_deck"}));
  byId("DrawDiscardBtn").addEventListener("click", () => dispatch({type: "draw_discard"}));
  byId("DiscardBtn").addEventListener("click", () => dispatch({type: "discard_drawn"}));
  byId("SkipBtn").addEventListener("click", () => dispatch({type: "skip_ability"}));
  byId("NextRoundBtn").addEventListener("click", () => dispatch({type: "next_round"}));

  panel.addEventListener("click", event => {
    if (!active() || explaining || dialog.open) return;
    const card = event.target.closest("[data-pa-player]");
    if (card) {
      const playerId = card.dataset.paPlayer;
      const slot = Number(card.dataset.paSlot);
      if (selectable(playerId, slot)) selectSlot(playerId, slot);
      else if (gesture?.pointerType !== "mouse") showTip(card, true);
      return;
    }
    if (!event.target.closest("button, a, summary, [data-pa-tip], .pa-choice")) { resetSelection(); renderTable(); renderActions(); }
    const staticTip = event.target.closest("[data-pa-tip]");
    if (staticTip && !event.target.closest("button") && gesture?.pointerType !== "mouse") showTip(staticTip, true);
  });
  panel.addEventListener("pointerover", event => {
    if (event.pointerType !== "mouse" || !active()) return;
    const target = event.target.closest("[data-pa-tip]");
    if (target && (!target.matches("button") || target.getAttribute("aria-disabled") === "true")) showTip(target);
  });
  panel.addEventListener("pointerout", event => { if (tipAnchor && !tipAnchor.contains(event.relatedTarget)) hideTip(); });
  panel.addEventListener("focusin", event => { const target = event.target.closest("[data-pa-tip]"); if (target && !target.matches("button")) showTip(target); });
  panel.addEventListener("focusout", hideTip);

  function targetAtPoint(event) {
    const direct = event.target.closest?.("[data-pa-explain]");
    if (direct && panel.contains(direct)) return direct;
    return Array.from(panel.querySelectorAll("[data-pa-explain]")).find(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
  }
  document.addEventListener("pointerdown", event => {
    if (!active() || dialog.open) return;
    if (event.target.closest("#pokemonAdventureHelpBtn, #pokemonAdventureExplainBtn")) return;
    const inside = panel.contains(event.target);
    if (inside) gesture = {pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, pointerType: event.pointerType};
    if (!explaining || !inside) return;
    explainGesture = {target: targetAtPoint(event), x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId};
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  document.addEventListener("pointermove", event => {
    if (gesture?.pointerId === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 9) gesture.moved = true;
    if (explainGesture?.pointerId === event.pointerId && Math.hypot(event.clientX - explainGesture.x, event.clientY - explainGesture.y) > 9) explainGesture.moved = true;
  }, {capture: true, passive: true});
  document.addEventListener("pointerup", event => {
    if (gesture?.pointerId === event.pointerId && gesture.moved) suppressClickUntil = performance.now() + 550;
    if (!explainGesture || explainGesture.pointerId !== event.pointerId) return;
    const target = explainGesture.target;
    const moved = explainGesture.moved;
    explainGesture = null;
    suppressClickUntil = performance.now() + 550;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!moved && target && explaining) explain(target);
  }, true);
  document.addEventListener("pointercancel", event => {
    if (gesture?.pointerId === event.pointerId) { gesture = null; suppressClickUntil = performance.now() + 550; }
    if (explainGesture?.pointerId === event.pointerId) explainGesture = null;
  }, true);
  document.addEventListener("click", event => {
    if (!active()) return;
    if (event.target.closest("#pokemonAdventureHelpBtn, #pokemonAdventureExplainBtn")) return;
    if (dialog.contains(event.target)) return;
    if (performance.now() < suppressClickUntil && panel.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (dialog.open) return;
    if (!explaining) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const target = targetAtPoint(event);
    if (target) explain(target);
  }, true);
  document.addEventListener("keydown", event => {
    if (!active()) return;
    if (event.key === "Escape") {
      hideTip();
      if (dialog.open) { dialog.close(); event.preventDefault(); }
      else if (explaining) setExplain(false);
      else { resetSelection(); renderTable(); renderActions(); }
    }
    if (explaining && ["Enter", " "].includes(event.key) && event.target.closest("button, a, input, select")) {
      if (event.target.closest("#pokemonAdventureHelpBtn, #pokemonAdventureExplainBtn")) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const target = event.target.closest("[data-pa-explain]");
      if (target) explain(target);
    }
  }, true);

  function clear() {
    view = null; signature = null; pending = false;
    clearTimeout(pendingTimer);
    resetSelection(); hideTip(); setExplain(false);
    if (dialog.open) dialog.close();
    document.body.classList.remove("pa-your-turn");
    render();
    feedback();
  }
  window.renderPokemonAdventureGameState = data => {
    if (!active() || data?.game_type && data.game_type !== "pokemon_adventure") return;
    if (data?.room_id && typeof currentRoomState !== "undefined" && data.room_id !== currentRoomState?.room_id) return;
    const next = data?.view || data;
    if (!next || next.game_id && next.game_id !== "pokemon_adventure") return;
    const nextSignature = JSON.stringify([data.room_id, next.you, next.round, next.turn, next.phase, next.current_turn, next.drawn?.card?.id, next.pending_ability, next.ditto_choices]);
    if (signature !== nextSignature) resetSelection();
    if (view && view.you !== next.you) { hideTip(); setExplain(false); }
    signature = nextSignature; view = next;
    pending = false; clearTimeout(pendingTimer); feedback();
    render();
  };
  window.clearPokemonAdventureState = clear;
  window.showPokemonAdventureHeaderActions = visible => {
    byId("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) clear();
  };
  window.getPokemonAdventureConfig = () => ({target_tokens: 3});

  function syncRoom(state) {
    if (state?.game_type !== "pokemon_adventure" || state.status === "lobby") clear();
    if (state?.game_type === "pokemon_adventure") byId("HeaderActions").style.display = "flex";
  }
  function initialize() {
    if (typeof socket !== "undefined") {
      socket.on("room:state", syncRoom);
      socket.on("system:error", error => { if (!active() || !pending) return; pending = false; clearTimeout(pendingTimer); feedback(typeof error === "string" ? error : error?.message || "Action failed. Please try again."); render(); });
      socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); if (active()) render(); });
      socket.on("connect", () => { if (active()) render(); });
    }
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "pokemon_adventure") window.renderPokemonAdventureGameState(lastGameStatePayload);
    else render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, {once: true});
  else initialize();
})();
