(() => {
  "use strict";
  const byId = suffix => document.getElementById(`startups${suffix}`);
  const panel = byId("Panel"), header = byId("HeaderActions"), configBox = byId("ConfigBox");
  const dialog = byId("Dialog"), tooltip = byId("Tooltip");
  let view = null, selection = null, pending = false, explaining = false;
  let pendingTimer, tipTimer, suppressTimer, suppressClick = false, focusBeforeDialog;
  let configSignature = null, renderSignature = null;
  const explanations = {
    round: ["Round · 局数", "默认单局。四局赛每局按财富排名：第一名 +2、第二名 +1、最后一名 −1，其余 0。下局由上局最后一名先手，所有资本和牌重置。"],
    deck: ["Deck（🂠）· 牌堆", "45 张股份，每局暗移除 5 张，每人发 3 张。剩余数量不包括手牌、市场和公开投资。抽走最后一张的玩家仍须放一张牌，随后全部手牌同时计入股份并结算。"],
    company: ["Company（公司）· 发行量", "🦒 Giraffe Beer 5、🐶 Bowwow Games 6、🦩 Flamingo Soft 7、🐙 Octo Coffee 8、🦛 Hippo Powertech 9、🐘 Elephant Mars Travel 10。牌上数字是整副牌的发行总量，不是分值。每张代表一股。"],
    marker: ["Anti-Monopoly（🚫）· 反垄断标记", "公开持股最多者持有标记。首张投资取得标记，追平时原持有者保留，严格超过才转移。持有者不能从市场拿该公司股份，但抽牌时不必给该公司市场牌付资本。结算最高并列时标记不破平，所有人都不收付。"],
    capital: ["Capital（💰）· 资本", "每局从 10 枚开始，抽牌费用按市场中需要付费的牌逐张计算；从市场拿牌时收走牌上资本。每枚未支出的资本价值 1。结算时支付方每张小股东股份只失去 1；收到的筹码翻为 3 分。"],
    draw: ["Draw · 从牌堆抽牌", "先给市场中未被自己反垄断标记（🚫）豁免的每张牌支付 1 枚资本（💰），再秘密抽 1 张。相同公司有多张牌也逐张收费。资本不够不能抽。空市场或全部豁免时免费。"],
    take: ["Take Card · 从市场拿牌", "拿走选中的股份和上面全部资本（💰）。持有反垄断标记（🚫）的公司不能拿。随后必须放一张手牌，本回合不能把同公司的任何手牌弃回市场。"],
    hand: ["Hand（🃏）· 隐藏手牌", "拿牌后从四张手牌中放一张，回合结束保持三张。其他人只能看到数量。牌堆耗尽后全部手牌一起计入最终持股，未投资的牌同样可能带来收入或支出。"],
    invest: ["Invest · 公开投资", "将所选股份放到自己面前，成为公开持股（📊）。若严格超过该公司反垄断标记（🚫）的持有者，立即取得标记。已投资的牌不能收回或弃掉。"],
    discard: ["To Market · 弃到市场", "把所选股份放进公共市场，其上资本（💰）从 0 开始。若这回合从市场拿过股份，不能把任何同公司的手牌放回市场，即使不是刚拿到的那一张。"],
    portfolio: ["Portfolio（📊）· 持股", "游戏中显示已公开投资的数量，不含隐藏手牌（🃏）；结算时自动把手牌加上。每家公司只有唯一最多股份者收款，最高并列则该公司无人收付。"],
    wealth: ["Wealth（💰）· 最终财富", "结算前资本 − 付出的筹码数 + 3 × 收入筹码数。资本不足可以负债，不用刚收到的 3 分筹码偿付。财富相同比收入筹码数，再比最近完成回合的顺序。"],
    income: ["Income（🪙）· 收入筹码", "每家公司唯一最大股东从其他股东每张股份收 1 枚筹码；收到后每枚计 3 分。支出方每枚只失去 1 分。收入筹码数也是本局财富相同的第一破平条件。"],
    points: ["Match points（🏆）· 比赛积分", "四局赛第一名 +2、第二名 +1、最后一名 −1，其余 0。最终比累计积分，再比第一名次数、第二名次数，最后比第四局排名。单局直接比较最终财富（💰）。"],
    next: ["Next Round", "确认看完结算。所有玩家确认后才开始下一局，机器人自动确认自己，断线真人仍需重连后确认。最终结果会保留。"],
    cancel: ["Cancel", "取消当前选牌，不执行任何游戏动作。也可以点击空白处或按 Esc。"],
  };
  const help = `
    <h3>把握最大的那份股份</h3><p>3–7 人。公开投资和三张隐藏手牌（🃏）共同决定最终股份。每家公司只有唯一最大股东能够获得收入（🪙），最终财富（💰）最高者获胜。</p>
    <h3>六家公司，共 45 张股份</h3><p>🦒 Giraffe Beer ×5 · 🐶 Bowwow Games ×6 · 🦩 Flamingo Soft ×7 · 🐙 Octo Coffee ×8 · 🦛 Hippo Powertech ×9 · 🐘 Elephant Mars Travel ×10。数字是整副牌的发行量，不是分值；每张代表一股。</p><p>每局随机暗移除 5 张，每人拿 3 张手牌和 10 枚 Capital（💰，资本）。市场从空开始，牌堆（🂠）面朝下。线上首局随机先手，按座位顺序轮转，资本和公开持股可见。</p>
    <h3>每回合：拿一张，再放一张</h3><p><strong>Draw：</strong>给市场里每张牌支付 1 枚资本后，秘密抽一张牌。自己持有反垄断标记（🚫）的公司免付；同公司多张牌按张数收费。钱不够不能抽，空市场免费。</p><p><strong>Take Card：</strong>从市场选一张股份，连同其上全部资本拿到自己手里。不能拿自己持有反垄断标记的公司。</p><p>随后从四张手牌中选一张：<strong>Invest</strong> 放到自己面前，加入 Portfolio（📊，公开持股）；或 <strong>To Market</strong> 弃到市场，牌上资本从 0 开始。<strong>从市场拿牌后，本回合不能弃同公司的任何牌</strong>。放牌后手里重新保持三张。</p>
    <h3>Anti-Monopoly（🚫，反垄断标记）</h3><p>第一位公开投资该公司的玩家取得标记；只有别人公开持股<strong>严格超过</strong>你时才转移。追平时原持有者保留，隐藏手牌此时不参与比较。标记让你免付该公司抽牌费用，也限制你从市场拿该公司牌。它不是最终结算的平手优势。</p>
    <h3>最后一张与结算</h3><p>抽走牌堆最后一张的人仍须完成放牌，然后立刻结束本局；其他人不再行动。全部手牌同时公开并加入最终持股，市场和暗移除的牌不计入。</p><p>每家公司若有唯一最大股东，其他股东每持有一张该公司股份，就付给他 <strong>1 枚资本</strong>。收到的筹码翻到 <strong>3 分面</strong>。最高持股并列时，该公司所有人都不收付。资本不足时记负债，不使用新收到的 3 分筹码支付。</p>
    <p class="startups-rule-example">例如 A 有 4 股、B 有 2 股、C 有 1 股：<br>A 收入 3 枚筹码＝+9 分；B 支出 2；C 支出 1。<br>最终 Wealth（💰，财富）＝结算前资本 − 支出 + 3 × 收入筹码。<br>B 若只剩 1 枚资本且没有其他收入，最终为 −1。</p>
    <p>本局先比财富，再比收入筹码数，仍相同则最近完成回合者优先。结算卡片展示资本、支出、收入和财富；Company settlements 可展开查看逐公司收付。</p>
    <h3>四局赛 · Match points（🏆）</h3><p>可在开始前选择 Four-round match。每局第一名 +2、第二名 +1、最后一名 −1，其余 0。所有玩家点击 <strong>Next Round</strong> 后，回收全部牌并重新准备，上一局最后一名先手。四局后比累计积分、第一名次数、第二名次数，最后按第四局排名破平。此最后一步也明确覆盖第四局冠军不在并列者中的情形。</p>
    <h3>操作</h3><p>点选市场或手牌后，在同一区域确认；点击空白、Cancel 或 Esc 取消。Draw 和 Next Round 直接执行。Help 集中规则，Explain 再点牌面、指标或按钮可解释，灰色按钮也支持。Esc 退出解释或关闭弹窗。静态图标可悬停，手机点击提示三秒后消失。机器人只使用自己的手牌及公开信息，是练习级对手。</p>
    <p><a href="https://oinkgames.com/en/games/analog/startups/" target="_blank" rel="noopener noreferrer">Oink Games · Startups</a> · <a href="https://hobbygames.ru/download/rules/startups-rules.pdf" target="_blank" rel="noopener noreferrer">Rules reference</a></p>`;

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  function text(suffix, value) { byId(suffix).textContent = value; }
  function company(id) { return view.companies.find(item => item.id === id); }
  function name(id) { return view?.players.find(player => player.player_id === id)?.name || id || "—"; }
  function label(id) { const c = company(id); return `${c.emoji} ${c.name}`; }
  function can(kind) { return !!view && !pending && socket.connected && view.legal_actions.includes(kind); }
  function tip(node, key, message) {
    node.dataset.suExplain = key;
    node.dataset.suTip = message || explanations[key][1];
    if (node.tagName !== "BUTTON") node.tabIndex = 0;
    return node;
  }
  function makeCard(card, area, coins = 0) {
    const c = company(card.company), node = el("button", `startups-card su-${c.id}`);
    node.type = "button"; node.dataset.cardId = card.id; node.dataset.area = area;
    const blocked = area === "market" && view.anti_monopoly[c.id] === view.you;
    node.disabled = area === "market" ? !can("take_market") || blocked : !can("invest");
    node.classList.toggle("is-blocked", blocked);
    node.classList.toggle("is-selected", selection?.id === card.id && selection?.area === area);
    node.setAttribute("aria-pressed", String(selection?.id === card.id && selection?.area === area));
    node.setAttribute("aria-label", `${c.name}, ${c.supply} total shares${area === "market" ? `, ${coins} capital${blocked ? ", blocked by your anti-monopoly marker" : ""}` : ""}`);
    const top = el("span", "startups-card-top");
    top.append(el("span", "", `${c.supply}×`), el("span", "", blocked ? "🚫" : "SHARE"));
    node.append(top, el("span", "startups-card-icon", c.emoji), el("span", "startups-card-name", c.name));
    if (area === "market") node.append(el("span", "startups-card-coins", `💰 +${coins}`));
    tip(node, area === "market" ? blocked ? "marker" : "take" : "hand",
      `${label(c.id)}：全牌组 ${c.supply} 股。${area === "market" ? `拿牌可获得 ${coins} 枚资本（💰）。${blocked ? "你的反垄断标记（🚫）阻止拿取。" : ""}` : "你的隐藏股份，结算时也会计入持股。"}`);
    return node;
  }
  function renderCompanies() {
    const container = byId("Companies"); container.replaceChildren();
    for (const c of view.companies) {
      const node = tip(el("div", `startups-company su-${c.id}`), "marker",
        `${label(c.id)}：发行 ${c.supply} 股。反垄断标记（🚫）：${view.anti_monopoly[c.id] ? name(view.anti_monopoly[c.id]) : "无人持有"}。`);
      const top = el("div", "startups-company-top");
      top.append(el("span", "", c.emoji), tip(el("span", "", `${c.supply}×`), "company", `${label(c.id)}：整副牌中有 ${c.supply} 张股份，不是分值。`));
      node.append(top, el("strong", "", c.name), el("span", "startups-marker-name", view.anti_monopoly[c.id] ? `🚫 ${name(view.anti_monopoly[c.id])}` : "— Open"));
      container.append(node);
    }
  }
  function renderMarket() {
    const container = byId("Market"), scroll = container.scrollTop;
    container.replaceChildren();
    view.market.forEach(entry => container.append(makeCard(entry.card, "market", entry.coins)));
    if (!view.market.length) {
      const empty = el("div", "startups-empty");
      empty.append(el("span", "", "↗"), el("div", "", "No shares on the market")); container.append(empty);
    }
    container.scrollTop = scroll;
    byId("Draw").disabled = !can("draw");
    text("Draw", `Draw · 💰 ${view.draw_cost ?? "—"}`);
    let hint = view.hands_revealed ? "Market shares and capital are not scored." : "Select a share, or draw from the deck.";
    if (!view.hands_revealed && view.you === view.current_turn && view.phase === "take" && !view.legal_actions.includes("draw")) hint = "Not enough capital to draw. Take an available market share.";
    if (view.phase === "place") hint = view.taken_company ? `${label(view.taken_company)} cannot be returned to the market this turn.` : "Card drawn. Choose one share from your hand.";
    text("MarketHint", hint);
    const chosen = selection?.area === "market" ? view.market.find(entry => entry.card.id === selection.id) : null;
    byId("MarketSelection").classList.toggle("hidden", !chosen);
    if (chosen) text("MarketLabel", `${label(chosen.card.company)} · 💰 +${chosen.coins}`);
    byId("Take").disabled = !chosen || !can("take_market");
  }
  function renderHand() {
    const container = byId("Hand"); container.replaceChildren();
    container.dataset.count = String(view.hand.length);
    view.hand.forEach(card => container.append(makeCard(card, "hand")));
    if (!view.hand.length) container.append(el("div", "startups-empty", "No private hand"));
    const own = view.players.find(player => player.player_id === view.you);
    text("Capital", own ? `💰 ${own.capital}` : "💰 —");
    text("HandTitle", view.hands_revealed ? "Revealed hand" : "Your hand");
    text("HandHint", view.hands_revealed ? "These shares are included in the final holdings." : can("invest") ? "Select one share to invest or send to the market." : "Your three hidden shares also count at settlement.");
    const chosen = selection?.area === "hand" ? view.hand.find(card => card.id === selection.id) : null;
    byId("HandSelection").classList.toggle("hidden", !chosen);
    if (chosen) text("HandLabel", label(chosen.company));
    byId("Invest").disabled = !chosen || !can("invest");
    byId("Discard").disabled = !chosen || !can("discard") || !view.legal_discard_ids.includes(chosen.id);
  }
  function renderPlayers() {
    const container = byId("Players"); container.replaceChildren();
    for (const player of view.players) {
      const node = el("article", "startups-player");
      node.classList.toggle("is-current", player.player_id === view.current_turn);
      node.classList.toggle("is-winner", view.winner_ids.includes(player.player_id));
      const heading = el("div", "startups-player-heading");
      heading.append(el("strong", "", player.name || player.player_id), el("small", "", [player.player_id === view.you ? "You" : "", player.is_bot ? "Bot" : "", view.ready.includes(player.player_id) ? "Ready ✓" : player.player_id === view.current_turn ? "Turn" : ""].filter(Boolean).join(" · ")));
      const stats = el("div", "startups-player-stats");
      stats.append(tip(el("span", "", `💰 ${view.hands_revealed ? player.round_score : player.capital}`), view.hands_revealed ? "wealth" : "capital"),
        tip(el("span", "", `🃏 ${player.hand_count}${view.hands_revealed ? " revealed" : " hidden"}`), "hand", view.hands_revealed ? `Hand（🃏）：${player.hand.map(card => label(card.company)).join(" · ")}` : explanations.hand[1]));
      if (view.config.rounds === 4) stats.append(tip(el("span", "", `🏆 ${player.match_points}`), "points"));
      const shares = el("div", "startups-shares");
      for (const c of view.companies) {
        const holder = view.anti_monopoly[c.id] === player.player_id;
        const count = player.shares[c.id], cell = tip(el("div", `startups-share su-${c.id}${count ? "" : " is-zero"}`, `${c.emoji} ${count}`), "portfolio", `${label(c.id)}：${count} 股${view.hands_revealed ? "（含手牌）" : "公开投资"}。${holder ? "持有反垄断标记（🚫）。" : ""}`);
        cell.append(el("span", "", holder ? " 🚫" : "")); shares.append(cell);
      }
      node.append(heading, stats, shares); container.append(node);
    }
  }
  function renderReview() {
    const summary = view.round_summary;
    byId("Review").classList.toggle("hidden", !summary);
    if (!summary) return;
    text("ReviewTitle", view.game_over ? "Final results" : `Round ${view.round_number} · Settlement`);
    text("Ready", view.game_over ? `Winner: ${view.winner_ids.map(name).join(" · ")}` : `${view.ready.length} / ${view.players.length} ready · Next round starts after everyone confirms.`);
    byId("Next").classList.toggle("hidden", view.game_over);
    byId("Next").disabled = !can("next_round");
    text("Next", view.ready.includes(view.you) ? "Ready ✓" : "Next Round");
    const container = byId("Scores"); container.replaceChildren();
    const rows = view.game_over && view.config.rounds === 4 ? view.final_ranking.map(id => summary.players.find(row => row.player_id === id)) : summary.players;
    for (const [index, row] of rows.entries()) {
      const node = el("article", "startups-score");
      const rank = view.game_over && view.config.rounds === 4 ? index + 1 : row.rank;
      node.append(el("strong", "", `${view.winner_ids.includes(row.player_id) ? "🏆 " : `#${rank} `}${name(row.player_id)}`),
        tip(el("span", "startups-score-total", view.config.rounds === 4 ? `${row.match_points} pts` : `${row.wealth}`), view.config.rounds === 4 ? "points" : "wealth"),
        tip(el("span", "", `💰 ${row.capital} − ${row.paid_chips} + ${row.income_chips} × 3 = ${row.wealth}`), "wealth"),
        tip(el("span", "", `🪙 ${row.income_chips} received · ${row.paid_chips} paid`), "income"));
      if (view.config.rounds === 4) node.append(tip(el("span", "", `Round #${row.rank} · ${row.award > 0 ? "+" : ""}${row.award} pts`), "points"));
      container.append(node);
    }
    const settlements = byId("Settlements"), scroll = settlements.scrollTop; settlements.replaceChildren();
    for (const row of summary.companies) {
      const node = el("div", ""); node.append(el("strong", "", label(row.company)));
      node.append(el("p", "", Object.entries(row.holdings).map(([id, count]) => `${name(id)} ${count}`).join(" · ")));
      node.append(el("p", "", row.winner_id ? `${name(row.winner_id)}: +${row.payments.reduce((sum, payment) => sum + payment.chips * 3, 0)} · ${row.payments.map(payment => `${name(payment.from)} pays ${payment.chips}`).join(" / ") || "No minority shareholders"}` : row.tied_ids.length ? "Tied majority · No payments" : "No shareholders · No payments"));
      settlements.append(node);
    }
    settlements.scrollTop = scroll;
  }
  function renderHistory() {
    const container = byId("History"), scroll = container.scrollTop; container.replaceChildren();
    for (const record of [...view.history].reverse()) {
      const action = record.type === "draw" ? `drew a hidden share · 💰 −${record.cost}` : record.type === "take_market" ? `took ${label(record.company)} · 💰 +${record.coins}` : `${record.type === "invest" ? "invested in" : "sent to market:"} ${label(record.company)}`;
      container.append(el("li", "", `${name(record.player_id)} ${action}`));
    }
    container.scrollTop = scroll;
    const scores = byId("ScoreHistory"), scoreScroll = scores.scrollTop; scores.replaceChildren();
    for (const round of view.score_history) {
      const node = el("div", ""); node.append(el("strong", "", `Round ${round.round_number}`));
      round.players.forEach(row => node.append(el("div", "", `${name(row.player_id)}: ${row.wealth}${view.config.rounds === 4 ? ` · ${row.award > 0 ? "+" : ""}${row.award} pts` : ""}`)));
      scores.append(node);
    }
    if (!view.score_history.length) scores.append(el("div", "", "No settled rounds yet."));
    scores.scrollTop = scoreScroll;
  }
  function render() {
    if (!view) return;
    text("Round", `Round ${view.round_number} / ${view.config.rounds}`); text("Deck", `🂠 ${view.deck_count}`);
    let status = view.you === view.current_turn ? `Your turn · ${view.phase === "take" ? "Take a share" : "Invest or send to market"}` : `${name(view.current_turn)} · ${view.phase === "take" ? "Taking a share" : "Placing a share"}`;
    if (view.phase === "round_review") status = "Round complete · Review the settlement";
    if (view.game_over) status = `Winner: ${view.winner_ids.map(name).join(" · ")}`;
    if (!socket.connected) status = "Disconnected · Reconnecting…";
    text("Status", status);
    renderCompanies(); renderMarket(); renderHand(); renderPlayers(); renderReview(); renderHistory();
  }
  function deselect() { if (!selection) return; selection = null; if (view) { renderMarket(); renderHand(); } }
  function dispatch(kind, extra = {}) {
    if (explaining || !can(kind)) return;
    const context = {game_token: view.game_token, round_number: view.round_number, turn_number: view.turn_number};
    pending = true; clearTimeout(pendingTimer); hideTip();
    pendingTimer = setTimeout(() => { pending = false; render(); }, 2500);
    render(); sendAction({type: kind, ...context, ...extra});
  }
  ["Market", "Hand"].forEach(suffix => byId(suffix).addEventListener("click", event => {
    const card = event.target.closest("button[data-card-id]");
    if (!card || card.disabled || explaining) return;
    selection = selection?.id === card.dataset.cardId ? null : {id: card.dataset.cardId, area: card.dataset.area};
    hideTip(); renderMarket(); renderHand();
  }));
  byId("Draw").addEventListener("click", () => dispatch("draw"));
  byId("Take").addEventListener("click", () => { if (selection?.area === "market") dispatch("take_market", {card_id: selection.id}); });
  byId("Invest").addEventListener("click", () => { if (selection?.area === "hand") dispatch("invest", {card_id: selection.id}); });
  byId("Discard").addEventListener("click", () => { if (selection?.area === "hand") dispatch("discard", {card_id: selection.id}); });
  ["MarketCancel", "HandCancel"].forEach(suffix => byId(suffix).addEventListener("click", deselect));
  byId("Next").addEventListener("click", () => dispatch("next_round"));

  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || explaining || dialog.open) return;
    clearTimeout(tipTimer); tooltip.textContent = target.dataset.suTip; tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${rect.bottom + box.height + 18 < innerHeight ? rect.bottom + 7 : Math.max(12, rect.top - box.height - 7)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function setExplain(value) {
    explaining = value; panel.classList.toggle("startups-explaining", value);
    byId("ExplainBtn").setAttribute("aria-pressed", String(value)); hideTip();
  }
  function showDialog(title, body, html = false) {
    hideTip(); focusBeforeDialog = document.activeElement; text("DialogTitle", title);
    if (html) byId("DialogBody").innerHTML = body;
    else byId("DialogBody").replaceChildren(el("p", "", body));
    if (!dialog.open) dialog.showModal(); byId("DialogClose").focus();
  }
  function explain(target) {
    const entry = explanations[target?.dataset.suExplain];
    if (!entry) return;
    setExplain(false); showDialog(entry[0], entry[1]);
  }
  byId("HelpBtn").addEventListener("click", () => { setExplain(false); showDialog("Startups · 初创公司", help, true); });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  const exempt = target => target.closest("#startupsHelpBtn, #startupsExplainBtn, #startupsDialog");
  document.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const direct = event.target.closest("[data-su-explain]");
    const target = direct || [...panel.querySelectorAll("[data-su-explain]")].find(node => {
      const rect = node.getBoundingClientRect();
      return rect.width && rect.height && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    suppressClick = true; clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => { suppressClick = false; }, 750); explain(target);
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-su-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { setExplain(false); hideTip(); deselect(); }
    if (!explaining || exempt(event.target) || !["Enter", " "].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-su-explain]"));
  }, true);
  document.addEventListener("click", event => {
    if (!panel.classList.contains("hidden") && !dialog.open && !event.target.closest("button, input, select, dialog, summary, a")) deselect();
  });
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-su-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-su-tip]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("pointerdown", event => {
    const target = event.target.closest("button:disabled[data-su-tip]");
    if (target && event.pointerType !== "mouse") showTip(target, true);
  });
  panel.addEventListener("click", event => {
    // Actionable cards already have a selection panel; static information uses tips.
    const target = event.target.closest("[data-su-tip]");
    if (target && !target.closest("button")) showTip(target, true); else hideTip();
  });
  document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);

  function clearState() {
    view = null; selection = null; pending = false; renderSignature = null;
    suppressClick = false; clearTimeout(pendingTimer); clearTimeout(suppressTimer);
    setExplain(false); hideTip(); if (dialog.open) dialog.close();
    ["Companies", "Market", "Hand", "Players", "Scores", "Settlements", "History", "ScoreHistory"].forEach(suffix => byId(suffix).replaceChildren());
    ["MarketSelection", "HandSelection", "Review"].forEach(suffix => byId(suffix).classList.add("hidden"));
    ["Draw", "Take", "Invest", "Discard", "Next"].forEach(suffix => { byId(suffix).disabled = true; });
    text("Status", "Waiting to start"); text("Round", "Round —"); text("Deck", "🂠 —"); text("Capital", "💰 —");
    text("MarketHint", "The market starts empty."); text("HandHint", "Your shares will appear here.");
  }
  function syncConfig(state) {
    const visible = state?.game_type === "startups" && state.status === "lobby";
    configBox.classList.toggle("hidden", !visible); configBox.setAttribute("aria-hidden", String(!visible));
    if (state?.game_type !== "startups") return;
    const signature = JSON.stringify([state.room_id, state.game_config]);
    if (signature !== configSignature) { byId("Rounds").value = String(state.game_config?.rounds || 1); configSignature = signature; }
    if (visible && view) clearState();
  }
  window.getStartupsConfig = () => view && currentRoomState?.status !== "lobby" ? {...view.config} : {rounds: Number(byId("Rounds").value)};
  window.renderStartupsGameState = data => {
    if (data?.view?.game_id !== "startups" || currentGameType !== "startups") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const incoming = data.view;
    const signature = JSON.stringify([data.room_id, incoming.game_token, incoming.revision, incoming.you]);
    if (signature === renderSignature) return;
    if (!view || view.game_token !== incoming.game_token || view.round_number !== incoming.round_number || view.turn_number !== incoming.turn_number || view.phase !== incoming.phase) selection = null;
    pending = false; clearTimeout(pendingTimer); hideTip(); renderSignature = signature; view = incoming; render();
  };
  window.clearStartupsState = clearState;
  window.showStartupsHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) { clearState(); configBox.classList.add("hidden"); configBox.setAttribute("aria-hidden", "true"); }
    else if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
  };
  function sync() {
    socket.on("room:state", syncConfig);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); render(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); render(); });
    socket.on("connect", render);
    if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "startups") window.renderStartupsGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
