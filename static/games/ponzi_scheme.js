(() => {
    "use strict";
    const panel = document.getElementById("ponziSchemePanel");
    const header = document.getElementById("ponziSchemeHeaderActions");
    const helpButton = document.getElementById("ponziSchemeHelpBtn");
    const explainButton = document.getElementById("ponziSchemeExplainBtn");
    const dialog = document.getElementById("ponziSchemeDialog");
    const dialogTitle = document.getElementById("ponziSchemeDialogTitle");
    const dialogBody = document.getElementById("ponziSchemeDialogBody");
    const dialogClose = document.getElementById("ponziSchemeDialogClose");
    const phaseNames = {funding: "募资", trading: "暗盘交易", trade_response: "打开信封", market_remove: "调整市场", crash_discard: "市场崩盘", round_end: "本轮结算", game_over: "最终结算"};
    const explanations = {
        fund: "同时选择一个行业和一张资金牌。取得后该行业有 1／2／3 个时，必须取市场第 1／2／3 行。立即收本金，之后永久按周期付息；同类已有三个或更多，不能再募资取得。",
        market: "市场按本金从小到大排列，三行各三张，每取走一张立即补充并重排。蓝色起始牌被移除时永久出局。红色熊牌仍可募资，但会计入市场崩盘数量。",
        industry: "各行业分别按数量计分：1／2／3／4／5 个 = 1／3／6／10／15 分。交易可突破三个的募资上限。行业有独立颜色和图标，功能相同。",
        trade: "双方必须拥有所选同类行业。报价只给参与者看，发起时放入信封托管。对方必须卖出一个行业，或以相同价格反向买入你的一个行业；不可拒绝或改价。零元报价合法。",
        sell: "收下信封内的钱，交出一个约定行业。该行业对应的债务仍留在原持有人处，不跟随行业转移。",
        buy: "另付与报价相同的钱买入对方一个行业。原信封里的钱也退给对方；对方净收报价一次。余额不足时只能卖出。",
        remove: "你刚收到起始标记。选择任意一张市场资金牌移除，再补牌，随后检查崩盘。移除起始牌永久出局，其他牌进入弃牌堆。",
        crash: "市场熊牌达到人数时本轮崩盘一次，市场熊牌、弃牌、剩余牌库混洗。依新起始玩家顺序，各归还一个自己最多的行业，并列时自选。时间前进两格，越过到期点的债务也要付款一次。",
        luxury: "进阶模式中，可用一次发起交易的机会购买一件市场奢侈品。每件唯一，不能转卖，结束时增加所示分数。进阶模式现金不计分。",
        pass: "只跳过本次募资或发起交易的机会。你的债务仍然存在，市场调整后会照常推进时间与付息。收到暗盘报价后不能 Pass。",
        confirm: "确认当前选择并交给服务器验证。灰色时请先选择合法行业、卡牌或交易对象，并检查当前是否轮到你。",
        next: "本轮付息后暂停供全员回顾。每个席位各自点击 Next Round，所有人确认后才继续。掉线的人不会自动确认。",
        debt: "所有人的资金牌、利息、周期和到期位置都公开。1 格内和 2 格内分别表示正常推进／崩盘时要支付的总额。付息后回到原周期，不会偿清本金或消除债务。",
        history: "公共日志只记录行业流向，不公开秘密报价。Private trades 只显示你本人参与的金额。现金仅本人可见。",
    };
    let view = null;
    let signature = null;
    let selectedIndustry = null;
    let selectedCard = null;
    let selectedTarget = null;
    let amount = "0";
    let pending = false;
    let pendingTimer = null;
    let explaining = false;
    let suppressedPointer = null;
    let returnFocus = null;
    const immediateTip = document.createElement("div");
    immediateTip.id = "ponziSchemeImmediateTip";
    immediateTip.className = "ponzi-scheme-immediate-tip";
    immediateTip.hidden = true;
    document.body.appendChild(immediateTip);
    let tipAnchor = null;
    let tipTimer = null;
    let tipHideTimer = null;
    let touchStart = null;
    let inputKind = "mouse";
    const openDetails = new Set();
    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
    const own = () => view?.players.find(player => player.player_id === view.you);
    const name = pid => view.players.find(player => player.player_id === pid)?.name || "—";
    const available = type => !pending && view?.legal_actions.includes(type);
    const industryLabel = key => `${view.industry_defs[key].icon} ${view.industry_defs[key].name}`;
    const button = (label, action, explain, disabled = false, attributes = "") => `<button type="button" data-ps-action="${action}" data-ps-explain="${explain}" ${disabled ? "disabled" : ""} ${attributes}>${label}</button>`;

    function resetSelection() {
        selectedIndustry = null; selectedCard = null; selectedTarget = null; amount = "0";
    }

    function candidate() {
        if (available("fund")) return view.fund_options.find(option => option.industry === selectedIndustry && option.card_id === selectedCard) || null;
        if (available("remove_fund") && selectedCard) return {type: "remove_fund", card_id: selectedCard};
        if (available("discard_industry") && view.crash_choices.includes(selectedIndustry)) return {type: "discard_industry", industry: selectedIndustry};
        if (available("offer_trade") && selectedTarget && selectedIndustry && /^\d+$/.test(amount)) {
            const value = Number(amount);
            const legalTarget = view.trade_targets.some(target => target.target === selectedTarget && target.industry === selectedIndustry);
            if (legalTarget && Number.isSafeInteger(value) && value <= own().cash) return {type: "offer_trade", target: selectedTarget, industry: selectedIndustry, amount: value};
        }
        return null;
    }

    function confirmLabel() {
        const action = candidate();
        if (!action) return pending ? "Sending…" : "Confirm";
        if (action.type === "fund") {
            const card = view.market.find(item => item.id === action.card_id);
            return `募资 💵 ${card.principal} · ${industryLabel(action.industry)}`;
        }
        if (action.type === "offer_trade") return `Send offer · 💵 ${action.amount}`;
        if (action.type === "remove_fund") return `移除 💵 ${view.market.find(card => card.id === selectedCard).principal}`;
        return `归还 ${industryLabel(action.industry)} ×1`;
    }

    function cardHTML(card, index) {
        const canFund = available("fund") && view.fund_options.some(option => option.card_id === card.id && (!selectedIndustry || option.industry === selectedIndustry));
        const canSelect = canFund || available("remove_fund");
        return button(`<span class="ponzi-scheme-card-kind">${card.bear ? "🐻 熊市" : card.starting ? "起始资金" : "资金"}</span>
            <strong class="ponzi-scheme-principal">${card.principal}</strong><span class="ponzi-scheme-card-caption">💵 立即获得</span>
            <span class="ponzi-scheme-card-terms"><span>利息 <b>${card.interest}</b></span><span>⏳ 每 ${card.period} 格</span></span>`,
            "card", "market", !canSelect,
            `class="ponzi-scheme-fund ${card.bear ? "is-bear" : card.starting ? "is-starting" : ""} ${selectedCard === card.id ? "is-selected" : ""}" data-card="${card.id}" data-row="${Math.floor(index / 3) + 1}" aria-pressed="${selectedCard === card.id}" aria-label="资金 ${card.principal}，每 ${card.period} 格付息 ${card.interest}${card.bear ? '，熊牌' : ''}"`);
    }

    function marketHTML() {
        return `<section class="ponzi-scheme-market ponzi-scheme-box"><div class="ponzi-scheme-section-head"><h3>📈 资金市场</h3><span>本金 ↑ · ${view.deck_count} cards left</span></div>
            <div class="ponzi-scheme-market-rows">${[0, 1, 2].map(row => `<div class="ponzi-scheme-market-row ${selectedIndustry && own()?.industries[selectedIndustry] === row && available("fund") ? "is-eligible" : ""}">
                <div class="ponzi-scheme-row-title"><b>${row + 1}</b><span>第 ${row + 1} 个<br />同类行业</span></div>
                <div class="ponzi-scheme-market-cards">${view.market.slice(row * 3, row * 3 + 3).map((card, i) => cardHTML(card, row * 3 + i)).join("")}</div></div>`).join("")}</div>
            <p class="ponzi-scheme-hint">先选行业，再选对应行资金牌；本金只收一次，利息循环支付。</p>
            <div class="ponzi-scheme-supply">${Object.entries(view.industry_defs).map(([key, spec]) => `<span class="ponzi-scheme-chip ponzi-scheme-${spec.color}">${spec.icon} ${spec.name} <b>${view.supply[key]}</b></span>`).join("")}</div></section>`;
    }

    function industryChoices(keys, mode) {
        return `<div class="ponzi-scheme-industry-choices">${keys.map(key => {
            const spec = view.industry_defs[key];
            const count = own()?.industries[key] || 0;
            const enabled = mode !== "fund" || view.fund_options.some(option => option.industry === key);
            return button(`<span>${spec.icon} ${spec.name}</span><small>${mode === "fund" ? `${count} → ${count + 1} 个${count >= 3 ? ' · 已达上限' : ` · 第 ${count + 1} 行`}` : `持有 ${count} 个`}</small>`, "industry", mode === "crash" ? "crash" : "industry", !enabled || pending,
                `class="ponzi-scheme-industry ponzi-scheme-${spec.color} ${selectedIndustry === key ? "is-selected" : ""}" data-industry="${key}" aria-pressed="${selectedIndustry === key}"`);
        }).join("")}</div>`;
    }

    function tradeHTML() {
        const targets = [...new Set(view.trade_targets.map(option => option.target))];
        const keys = [...new Set(view.trade_targets.filter(option => option.target === selectedTarget).map(option => option.industry))];
        return `<p class="ponzi-scheme-hint">选择交易对象与共同拥有的行业。报价对方必须接受或同价反买。</p>
            <div class="ponzi-scheme-targets">${targets.map(pid => button(esc(name(pid)), "target", "trade", pending, `class="${selectedTarget === pid ? "is-selected" : ""}" data-target="${esc(pid)}" aria-pressed="${selectedTarget === pid}"`)).join("")}</div>
            ${keys.length ? industryChoices(keys, "trade") : ""}
            <label class="ponzi-scheme-price" for="ponziSchemeOfferAmount"><span>💵 秘密报价</span><input id="ponziSchemeOfferAmount" type="number" inputmode="numeric" min="0" max="${own().cash}" step="1" value="${esc(amount)}" ${pending ? "disabled" : ""} /></label>
            <div class="ponzi-scheme-price-buttons">${[-5, -1, 1, 5].map(delta => button(delta > 0 ? `+${delta}` : String(delta), "amount", "trade", pending, `data-delta="${delta}"`)).join("")}</div>
            <p class="ponzi-scheme-hint ponzi-scheme-trade-budget">可用 💵 ${own().cash} · 报价先托管，只有双方可见。</p>`;
    }

    function offerHTML() {
        const offer = view.offer;
        if (!offer) return "";
        const involved = Object.hasOwn(offer, "amount");
        const responding = available("respond_trade");
        return `<div class="ponzi-scheme-envelope"><span class="ponzi-scheme-envelope-icon">✉️</span><strong>${esc(name(offer.source))} → ${esc(name(offer.target))}</strong>
            <span>${industryLabel(offer.industry)} ×1</span><b class="ponzi-scheme-offer-value">${involved ? `💵 ${offer.amount}` : "🔒 Secret offer"}</b>
            <p>${responding ? "选择卖出你的行业，或按同价反买对方行业。" : `Waiting for ${esc(name(offer.target))}`}</p>
            ${responding ? `<div class="ponzi-scheme-two-buttons">${button(`Sell · +${offer.amount}`, "sell", "sell")}${button(`Buy · −${offer.amount}`, "buy", "buy", own().cash < offer.amount)}</div>
                ${own().cash < offer.amount ? '<small>现金不足以反买，请选择 Sell。</small>' : ""}` : ""}
            ${offer.source === view.you ? `<small>💵 ${offer.amount} 已放入信封，未计入可用现金。</small>` : ""}</div>`;
    }

    function luxuryHTML() {
        if (!view.advanced) return `<p class="ponzi-scheme-hint ponzi-scheme-wealth">💎 现金计分：30 / 56 / 78 / 96 → 1 / 2 / 3 / 4 分</p>`;
        return `<div class="ponzi-scheme-luxuries"><h4>💎 奢侈品</h4><div class="ponzi-scheme-luxury-grid">${Object.entries(view.luxury_defs).map(([key, spec]) => {
            const sold = !view.luxuries.includes(key);
            return button(`<span>${spec.icon} ${spec.name}</span><small>${sold ? "Sold" : `💵 ${spec.cost} · ${spec.points} 分`}</small>`, "luxury", "luxury", sold || !available("buy_luxury") || own().cash < spec.cost, `data-luxury="${key}"`);
        }).join("")}</div></div>`;
    }

    function actionHTML() {
        let content = "";
        if (available("fund")) content = industryChoices(Object.keys(view.industry_defs), "fund");
        else if (available("offer_trade")) content = tradeHTML();
        else if (available("remove_fund")) content = '<p>从左侧市场点选一张资金牌，确认移除。</p>';
        else if (available("discard_industry")) content = `<p>归还一个数量最多的行业：</p>${industryChoices(view.crash_choices, "crash")}`;
        else if (view.phase === "round_end") {
            const ready = view.next_ready.includes(view.you);
            content = `<p>请回顾本轮结算，所有人确认后继续。</p>${button(ready ? "✓ Ready" : "Next Round", "next", "next", !available("next_round"), 'class="ponzi-scheme-primary"')}
                <p class="ponzi-scheme-hint">${view.next_ready.length} / ${view.players.length} ready<br />Waiting: ${view.players.filter(player => !view.next_ready.includes(player.player_id)).map(player => esc(player.name)).join(" · ") || "—"}</p>`;
        } else if (view.game_over) content = '<p>本局结束。胜者由存活玩家的行业和财富／奢侈品总分决定。</p>';
        else if (view.phase !== "trade_response") content = `<p>Waiting for ${esc(name(view.current_turn))}</p>`;
        const selecting = ["fund", "offer_trade", "remove_fund", "discard_industry"].some(type => view.legal_actions.includes(type));
        return `<section class="ponzi-scheme-box ponzi-scheme-action"><div class="ponzi-scheme-section-head"><h3>${view.current_turn === view.you ? "Your turn" : "Action"}</h3><span>${phaseNames[view.phase]}</span></div>
            ${view.phase === "trade_response" ? offerHTML() : content}
            ${selecting ? button(confirmLabel(), "confirm", "confirm", !candidate(), 'id="ponziSchemeConfirm" class="ponzi-scheme-primary"') : ""}
            ${view.legal_actions.includes("pass") ? button("Pass", "pass", "pass", pending, 'class="ponzi-scheme-pass"') : ""}
            ${view.phase === "trading" && !view.trade_targets.length && view.current_turn === view.you ? '<p class="ponzi-scheme-hint">没有可交易的共同行业。</p>' : ""}
            ${luxuryHTML()}</section>`;
    }

    function cashHTML() {
        const player = own();
        if (!player) return "";
        return `<section class="ponzi-scheme-cash"><div><span>🔒 私人金库</span><strong>💵 ${player.cash}</strong></div>
            <div class="ponzi-scheme-pressure"><span>正常付息 <b class="${player.cash < player.due_next ? "is-danger" : ""}">${player.due_next}</b></span><span>若崩盘 <b class="${player.cash < player.due_crash ? "is-danger" : ""}">${player.due_crash}</b></span></div>
            <small>${player.cash < player.due_next ? "⚠ 现金不足以支付下一次正常到期利息" : "⏳ 当前债务预测 · 未包含尚未取得的资金牌"}</small></section>`;
    }

    function debtsHTML(player) {
        return `<div class="ponzi-scheme-debt-track">${[1, 2, 3, 4, 5].map(step => {
            const cards = player.debts.filter(card => card.remaining === step);
            return `<div class="${step <= 2 && cards.length ? "is-due" : ""}"><small>${step} 格</small><b>${cards.reduce((sum, card) => sum + card.interest, 0)}</b></div>`;
        }).join("")}</div><details data-ps-details="debt-${esc(player.player_id)}" ${openDetails.has(`debt-${player.player_id}`) ? "open" : ""}>
            <summary data-ps-explain="debt">Debts · ${player.debts.length} cards</summary><div class="ponzi-scheme-debt-list">${player.debts.length ? player.debts.map(card => `<div><span>${card.bear ? "🐻" : "💵"} ${card.principal}</span><span>利息 ${card.interest} / ${card.period} 格</span><b>${card.remaining === 0 ? "到期" : `${card.remaining} 格后`}</b></div>`).join("") : '<p class="ponzi-scheme-hint">暂无债务</p>'}</div></details>`;
    }

    function playersHTML() {
        return `<section class="ponzi-scheme-portfolios"><div class="ponzi-scheme-section-head"><h3>🏢 产业与债务</h3><span>行业和债务公开 · 现金保密</span></div>
            <div class="ponzi-scheme-players">${view.players.map(player => `<article class="ponzi-scheme-player ${player.player_id === view.current_turn ? "is-active" : ""} ${player.bankrupt ? "is-bankrupt" : ""}">
                <div class="ponzi-scheme-player-heading"><h4>${esc(player.name)} ${player.player_id === view.you ? '<small>You</small>' : ""}</h4><span>${player.bankrupt ? "💥" : player.player_id === view.start_player ? "🖋️" : player.is_bot ? "🤖" : ""}</span></div>
                <div class="ponzi-scheme-portfolio-value"><strong>${player.industry_points} <small>行业分</small></strong><span>${player.player_id === view.you ? `💵 ${player.cash}` : "🔒 Private"}</span></div>
                <div class="ponzi-scheme-player-industries">${Object.entries(view.industry_defs).map(([key, spec]) => `<span class="ponzi-scheme-chip ponzi-scheme-${spec.color}" title="${spec.name}">${spec.icon} ${spec.name} <b>${player.industries[key]}</b></span>`).join("")}</div>
                ${player.luxuries.length ? `<div class="ponzi-scheme-owned-luxuries">${player.luxuries.map(lid => `${view.luxury_defs[lid].icon} +${view.luxury_defs[lid].points}`).join(" · ")}</div>` : ""}
                ${debtsHTML(player)}</article>`).join("")}</div></section>`;
    }

    function reviewHTML() {
        if (!["round_end", "game_over"].includes(view.phase) || !view.last_round) return "";
        const summary = view.last_round;
        return `<section class="ponzi-scheme-box ponzi-scheme-review"><div class="ponzi-scheme-section-head"><h3>${view.game_over ? "🏁 最终结算" : "⏸ 本轮结算"}</h3><span>${summary.crashed ? "🐻 崩盘 · 前进 2 格" : "⏳ 前进 1 格"}</span></div>
            ${view.game_over ? `<p class="ponzi-scheme-winner">${view.winner.length ? `🏆 ${view.winner.map(pid => esc(name(pid))).join(" · ")}` : "全员破产 · 无人获胜"}</p><div class="ponzi-scheme-scoreboard">${view.results.map(result => `<div class="ponzi-scheme-result ${result.bankrupt ? "is-bankrupt" : ""}"><strong>${esc(name(result.player_id))}</strong><span>${result.bankrupt ? "💥 破产" : `⭐ ${result.total} 分`}</span><small>行业 ${result.industry_points} + ${view.advanced ? `奢侈品 ${result.luxury_points}` : `财富 ${result.wealth_points}`} · 最大资金 ${result.highest_fund}</small></div>`).join("")}</div>` : ""}
            <div class="ponzi-scheme-payments">${summary.payments.map(payment => `<span>${esc(name(payment.player_id))}<b>${payment.bankrupt ? "💥 无法支付" : "✓ 已付"} 💵 ${payment.due}</b></span>`).join("")}</div>
            <details data-ps-details="review" ${openDetails.has("review") ? "open" : ""}><summary>Round details</summary><ol class="ponzi-scheme-log">${summary.notes.map(note => `<li>${esc(note)}</li>`).join("")}</ol></details></section>`;
    }

    function historyHTML() {
        return `<section class="ponzi-scheme-box ponzi-scheme-history"><details data-ps-details="history" ${openDetails.has("history") ? "open" : ""}><summary data-ps-explain="history">Activity · ${view.log.length}</summary>
            <ol class="ponzi-scheme-log">${view.log.slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ol></details>
            <details data-ps-details="private" ${openDetails.has("private") ? "open" : ""}><summary data-ps-explain="history"><span class="ponzi-scheme-private-lock">🔒</span> Private trades · ${view.private_trades.length}</summary><ul class="ponzi-scheme-log">${view.private_trades.slice().reverse().map(trade => `<li>Round ${trade.round} · ${esc(name(trade.seller))} → ${esc(name(trade.buyer))}<br />${industryLabel(trade.industry)} · 💵 ${trade.amount}</li>`).join("") || '<li>暂无记录</li>'}</ul></details></section>`;
    }

    function render() {
        if (!view) return;
        hideImmediateTip();
        panel.innerHTML = `<div class="ponzi-scheme-shell ${explaining ? "ponzi-scheme-explaining" : ""}">
            <div class="ponzi-scheme-masthead"><div><p class="ponzi-scheme-eyebrow">PONZI SCHEME · ${view.advanced ? "ADVANCED" : "BASIC"}</p><h2>庞氏骗局</h2><p class="ponzi-scheme-tagline">承诺下一个明天，撑过这一个今天。</p></div><div class="ponzi-scheme-round"><span>ROUND</span><strong>${view.round}</strong></div></div>
            <div class="ponzi-scheme-status" role="status"><div><b>${phaseNames[view.phase]}</b><span>${view.current_turn ? `${view.current_turn === view.you ? "Your turn" : "Waiting for"} · ${esc(name(view.current_turn))}` : view.game_over ? "Game over" : `${view.next_ready.length} / ${view.players.length} ready`}</span></div><span class="ponzi-scheme-bears ${view.bear_count >= view.players.length ? "is-danger" : ""}">🐻 ${view.bear_count} / ${view.players.length} 崩盘</span></div>
            ${reviewHTML()}<div class="ponzi-scheme-layout"><div>${marketHTML()}</div><aside class="ponzi-scheme-sidebar">${cashHTML()}${actionHTML()}${historyHTML()}</aside></div>${playersHTML()}
            <p class="ponzi-scheme-footer">72 张资金牌 · 16 张熊牌 · ${view.first_round_trading ? "首轮可交易" : "首轮跳过交易"} · ${view.advanced ? "进阶：现金不计分" : "基础：现金最多 4 分"}</p></div>`;
        decorateTips();
    }

    function describeCard(card) {
        return `${card.bear ? "熊市资金牌" : card.starting ? "起始资金牌" : "资金牌"}：本金 ${card.principal} 单位现金立即到账，此后每 ${card.period} 格支付 ${card.interest} 单位利息。${card.bear ? "留在市场的熊牌计入崩盘数量。" : card.starting ? "从市场移除后永久出局。" : "付息后债务继续循环。"}`;
    }

    function addTip(target, text) {
        if (!target) return;
        target.dataset.psTip = text;
        target.dataset.psExplain ||= "tip";
        target.setAttribute("tabindex", "0");
        target.setAttribute("aria-label", text);
        if (target.tagName !== "BUTTON") target.setAttribute("role", "button");
    }

    function decorateTips() {
        // Separate information buttons stay enabled even beside disabled game actions.
        panel.querySelectorAll("button[data-ps-explain]").forEach(control => {
            if (["pass", "target", "amount"].includes(control.dataset.psAction)) return;
            let text = explanations[control.dataset.psExplain];
            if (control.dataset.card) text = describeCard(view.market.find(card => card.id === control.dataset.card));
            if (control.dataset.industry) {
                const key = control.dataset.industry;
                text = `${view.industry_defs[key].name}产业：当前持有 ${own().industries[key]} 个。${explanations.industry} ${explanations.fund}`;
            }
            if (control.dataset.luxury) {
                const spec = view.luxury_defs[control.dataset.luxury];
                text = `${spec.name}：花费 ${spec.cost} 单位现金获得 ${spec.points} 分。${explanations.luxury}`;
            }
            if (control.dataset.psAction === "amount") text = "秘密报价调整：以现金为单位增减报价，不会发送信封。选择好双方共同行业后，点击 Send offer 才会提交。";
            const wrapper = document.createElement("div");
            wrapper.className = "ponzi-scheme-control" + (control.classList.contains("ponzi-scheme-primary") ? " is-primary-control" : "");
            if (control.dataset.card) wrapper.classList.add("is-card-control");
            control.replaceWith(wrapper);
            wrapper.appendChild(control);
            const info = document.createElement("button");
            info.type = "button";
            info.className = "ponzi-scheme-info";
            info.textContent = "ⓘ";
            addTip(info, text);
            wrapper.appendChild(info);
        });
        const mark = (selector, text) => panel.querySelectorAll(selector).forEach(target => addTip(target, text));
        mark(".ponzi-scheme-round", "轮数：当前进行的完整轮次。每轮募资、交易、调整市场并支付到期利息，直到出现破产。 ");
        mark(".ponzi-scheme-bears", "熊市预警：前一个数字是市场熊牌张数，后一个是玩家人数。调整市场后达到人数就崩盘，本轮时间会前进两格。");
        mark(".ponzi-scheme-status > div > b", `当前阶段：${phaseNames[view.phase]}。${({funding: explanations.fund, trading: explanations.trade, trade_response: explanations.trade, market_remove: explanations.remove, crash_discard: explanations.crash, round_end: explanations.next, game_over: "破产者出局，存活者按行业及财富／奢侈品计分。"})[view.phase]}`);
        mark(".ponzi-scheme-market h3", "资金市场：九张公开资金牌，按本金从小到大排成三行。根据取得行业后的数量选择对应行。");
        mark(".ponzi-scheme-cash > div:first-child > span, .ponzi-scheme-cash strong", "私人现金：只有你能看到的可用余额，单位为现金。用于暗盘交易、购买奢侈品及支付利息；已放入信封的金额暂不计入余额。");
        panel.querySelectorAll(".ponzi-scheme-pressure > span").forEach((target, index) => addTip(target,
            index ? "崩盘付息预测：当前债务在时间前进两格时要支付的现金总额。包括越过到期点的牌，每张只付一次。" : "正常付息预测：当前债务在时间前进一格时要支付的现金总额，零表示没有当前到期债务。"));
        mark(".ponzi-scheme-cash > small", "债务预测：根据当前已取得的资金牌计算。尚未募资的新牌不包含在内；交易与新募资会改变你的支付能力。");
        mark(".ponzi-scheme-wealth", "基础财富分：结束时剩余现金达到 30／56／78／96，分别得 1／2／3／4 分；最多 4 分。破产玩家不能获胜。");
        mark(".ponzi-scheme-price > span", "秘密报价：单位为现金，允许零元。加减按钮仅调整金额，点击 Send offer 才发送。发起时先托管，只有交易双方看到金额。");
        mark(".ponzi-scheme-trade-budget, .ponzi-scheme-envelope > small", "交易可用现金：放入信封的报价暂不计入可用余额。卖出时接收者拿到报价；反买时原报价退给发起者，接收者另付相同金额。");
        mark(".ponzi-scheme-private-lock", explanations.history);
        mark(".ponzi-scheme-envelope > span:not(.ponzi-scheme-envelope-icon)", view.offer ? `${view.industry_defs[view.offer.industry].name}产业：本次信封交易一个该行业。${explanations.trade}` : "");
        mark(".ponzi-scheme-market .ponzi-scheme-section-head > span, .ponzi-scheme-row-title", "市场排序与行号：本金从小到大排列。取得后的同类行业数量决定可选的第 1／2／3 行；cards left 表示尚未抽出的牌库张数。");
        mark(".ponzi-scheme-portfolios h3", "产业与公开债务：展示每名玩家的行业数量及循环利息，现金和暗盘价格保密。");
        mark(".ponzi-scheme-luxuries h4", explanations.luxury);
        mark(".ponzi-scheme-envelope-icon, .ponzi-scheme-offer-value", "秘密交易信封：显示双方约定的现金报价，只有参与者能看到金额；其他人只看到交易对象及行业。");
        mark(".ponzi-scheme-review h3, .ponzi-scheme-review .ponzi-scheme-section-head > span", "本轮结算：崩盘时推进两格，否则推进一格。所有人同时付息后在此回顾结果，全员 Next Round 才继续。");
        mark(".ponzi-scheme-winner", "获胜玩家：未破产玩家中总分最高者胜，同分比较持有资金牌的最高本金。全员破产时无人获胜。");
        const keys = Object.keys(view.industry_defs);
        panel.querySelectorAll(".ponzi-scheme-supply .ponzi-scheme-chip").forEach((target, index) => addTip(target,
            `${view.industry_defs[keys[index]].name}行业库存：${view.supply[keys[index]]} 个可供募资。每人同类行业不满三个时可取得一个，崩盘弃置会回到库存。`));
        panel.querySelectorAll(".ponzi-scheme-player").forEach((target, index) => {
            const player = view.players[index];
            const status = target.querySelector(".ponzi-scheme-player-heading > span");
            if (status.textContent) addTip(status, player.bankrupt ? "破产：无法全额支付本轮利息，失去获胜资格。" : player.player_id === view.start_player ? "起始玩家标记：本轮从该玩家开始。交易结束后交给下一位，由新持有人移除一张市场资金牌。" : "机器人玩家：只依据公开局面和自己的私人信息进行操作。");
            addTip(target.querySelector(".ponzi-scheme-portfolio-value > strong"), "行业分：四类行业分别按 n(n+1)/2 计分后相加，尚未包含财富或奢侈品分数。");
            addTip(target.querySelector(".ponzi-scheme-portfolio-value > span"), player.player_id === view.you ? "你的私人现金：可用于报价、反买和付息，其他玩家看不到这个余额。" : "私人现金已隐藏：其他玩家的现金数额属于秘密信息。");
            target.querySelectorAll(".ponzi-scheme-player-industries > span").forEach((chip, i) => addTip(chip, `${view.industry_defs[keys[i]].name}产业：持有 ${player.industries[keys[i]]} 个。${explanations.industry}`));
            addTip(target.querySelector(".ponzi-scheme-owned-luxuries"), `已购奢侈品：${player.luxuries.map(lid => `${view.luxury_defs[lid].name} ${view.luxury_defs[lid].points} 分`).join("、")}。这些资产公开且不可转卖。`);
            target.querySelectorAll(".ponzi-scheme-debt-track > div").forEach((slot, i) => addTip(slot, `债务到期位置：还需前进 ${i + 1} 格。大数字是该位置所有债务的利息总额，单位现金；零表示这里没有债务。`));
            target.querySelectorAll(".ponzi-scheme-debt-list > div").forEach((row, i) => addTip(row, `${describeCard(player.debts[i])} 当前${player.debts[i].remaining === 0 ? "已经到期" : `还需前进 ${player.debts[i].remaining} 格到期`}。`));
        });
        panel.querySelectorAll(".ponzi-scheme-payments > span").forEach((target, i) => {
            const payment = view.last_round.payments[i];
            addTip(target, `本轮付息：${name(payment.player_id)} 应付 ${payment.due} 单位现金，${payment.bankrupt ? "现金不足，已破产" : "已成功支付"}。`);
        });
        panel.querySelectorAll(".ponzi-scheme-result").forEach((target, i) => {
            const result = view.results[i];
            addTip(target, `最终得分：${name(result.player_id)}${result.bankrupt ? "破产，不参与排名" : `总计 ${result.total} 分`}。行业分加上${view.advanced ? "奢侈品分" : "剩余现金对应的财富分"}；最大资金本金用于同分决胜。`);
        });
        panel.querySelectorAll(".ponzi-scheme-log li").forEach(target => addTip(target, `事件记录：${target.textContent} 金额单位为现金，行业图标表示对应产业；秘密交易价格仅参与者可见。`));
    }

    function hideImmediateTip() {
        window.clearTimeout(tipTimer);
        window.clearTimeout(tipHideTimer);
        if (tipAnchor) tipAnchor.removeAttribute("aria-describedby");
        tipAnchor = null;
        immediateTip.hidden = true;
        immediateTip.textContent = "";
    }

    function showImmediateTip(target, touch = false) {
        if (!target?.dataset.psTip || explaining || dialog.open || panel.classList.contains("hidden")) return;
        hideImmediateTip();
        tipAnchor = target;
        immediateTip.setAttribute("role", touch ? "status" : "tooltip");
        immediateTip.setAttribute("aria-live", touch ? "polite" : "off");
        immediateTip.classList.toggle("is-touch", touch);
        immediateTip.textContent = target.dataset.psTip;
        immediateTip.hidden = false;
        target.setAttribute("aria-describedby", immediateTip.id);
        const anchor = target.getBoundingClientRect();
        const rect = immediateTip.getBoundingClientRect();
        const viewport = window.visualViewport;
        const width = viewport?.width || window.innerWidth;
        const height = viewport?.height || window.innerHeight;
        const topOffset = viewport?.offsetTop || 0;
        const leftOffset = viewport?.offsetLeft || 0;
        const left = touch ? (width - rect.width) / 2 : Math.min(width - rect.width - 10, Math.max(10, anchor.left));
        const preferTop = touch ? anchor.top > height / 2 : anchor.top > rect.height + 18;
        const top = touch ? (preferTop ? 12 : height - rect.height - 16) : (preferTop ? anchor.top - rect.height - 8 : anchor.bottom + 8);
        immediateTip.style.left = `${leftOffset + Math.max(10, left)}px`;
        immediateTip.style.top = `${topOffset + Math.max(10, Math.min(height - rect.height - 10, top))}px`;
        if (touch) tipTimer = window.setTimeout(hideImmediateTip, 3000);
    }

    function submit(action) {
        if (!action || pending || !available(action.type)) return;
        pending = true;
        render();
        sendAction(action);
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; render(); }, 6000);
    }

    function openDialog(title, content, html = false) {
        hideImmediateTip();
        returnFocus = document.activeElement;
        dialog.dataset.psKind = title === "Confirm purchase" ? "purchase" : "reference";
        dialogTitle.textContent = title;
        if (html) dialogBody.innerHTML = content;
        else dialogBody.textContent = content;
        if (!dialog.open) dialog.showModal();
    }

    function setExplain(enabled) {
        hideImmediateTip();
        explaining = enabled;
        explainButton.setAttribute("aria-pressed", String(enabled));
        panel.querySelector(".ponzi-scheme-shell")?.classList.toggle("ponzi-scheme-explaining", enabled);
    }

    panel.addEventListener("toggle", event => {
        const key = event.target.dataset?.psDetails;
        if (key) event.target.open ? openDetails.add(key) : openDetails.delete(key);
    }, true);
    panel.addEventListener("input", event => {
        if (event.target.id !== "ponziSchemeOfferAmount") return;
        amount = event.target.value;
        const confirm = document.getElementById("ponziSchemeConfirm");
        if (confirm) { confirm.disabled = !candidate(); confirm.textContent = confirmLabel(); }
    });
    panel.addEventListener("click", event => {
        const target = event.target.closest("button[data-ps-action]");
        if (!target || target.disabled || pending) return;
        const data = target.dataset;
        switch (data.psAction) {
            case "industry":
                selectedIndustry = selectedIndustry === data.industry ? null : data.industry;
                if (selectedCard && available("fund") && !view.fund_options.some(option => option.industry === selectedIndustry && option.card_id === selectedCard)) selectedCard = null;
                break;
            case "card": selectedCard = selectedCard === data.card ? null : data.card; break;
            case "target":
                selectedTarget = selectedTarget === data.target ? null : data.target;
                selectedIndustry = null;
                break;
            case "amount": amount = String(Math.max(0, Math.min(own().cash, (Number(amount) || 0) + Number(data.delta)))); break;
            case "confirm": submit(candidate()); return;
            case "pass": submit({type: "pass"}); return;
            case "sell": submit({type: "respond_trade", response: "sell"}); return;
            case "buy": submit({type: "respond_trade", response: "buy"}); return;
            case "next": submit({type: "next_round"}); return;
            case "luxury": {
                const spec = view.luxury_defs[data.luxury];
                openDialog("Confirm purchase", `<p>${spec.icon} ${spec.name} · 💵 ${spec.cost} → ${spec.points} 分</p><p>本轮发起交易机会将用于购买这件奢侈品。</p>${button("Buy", "confirm-luxury", "luxury", false, `data-luxury="${data.luxury}"`)}`, true);
                return;
            }
        }
        render();
    });
    dialog.addEventListener("click", event => {
        const purchase = event.target.closest('[data-ps-action="confirm-luxury"]');
        if (purchase) { dialog.close(); submit({type: "buy_luxury", luxury: purchase.dataset.luxury}); return; }
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    helpButton.addEventListener("click", () => {
        setExplain(false);
        openDialog("Ponzi Scheme · Help", `
            <p><strong>目标</strong>：不要成为最先破产的人。3–5 人，开局无现金、无行业；有人付不起利息时，所有当轮破产者落败，存活者按分数决胜。</p>
            <p><strong>① 募资</strong>：按起始玩家顺序，取得一个行业与一张对应行资金牌，或 Pass。取得后同类行业有 1／2／3 个，分别只能拿第 1／2／3 行；已有三个及以上不能再募资该行业。本金立即入账，只收一次。每次取牌后补市场到九张，按本金重新排序。</p>
            <p><strong>② 暗盘交易</strong>：每人有一次发起机会，可 Pass。选择双方均拥有的行业，给出秘密整数报价（可为零）。接收者必须卖出自己的一个行业并收钱，或支付同价反买发起者的一个行业。没有拒绝或改价；债务不会跟随行业转移，交易取得行业不受三个上限。</p>
            <p><strong>🔒 信封</strong>：报价从发起者可用现金中暂扣。卖出时交给接收者；反买时，报价退还发起者，接收者另支付同额。只有双方能看到价格或私人交易记录，他人只能看到行业流向。</p>
            <p><strong>③ 市场调整</strong>：起始标记顺移一位，新起始玩家移除市场任意一张牌，再补齐。起始牌永久出局，其他牌进入弃牌堆。牌库空时重洗弃牌。</p>
            <p><strong>④ 🐻 崩盘</strong>：调整后的熊牌数量达到玩家人数，本轮崩盘一次。所有市场熊牌、弃牌与剩余牌库混洗后补市场；不会立刻再次崩盘。自新起始玩家开始，每人归还一个自己最多的行业，并列时自选，无行业时跳过。</p>
            <p><strong>⑤ ⏳ 付息</strong>：通常时间前进一格；崩盘前进两格。到期或越过到期点的牌都只支付一次。所有人同时检查能否全额支付。付得起的扣款，债务回到原周期；付不起的破产。资金牌永远保留，不能提前付息或偿清债务。</p>
            <p><strong>⏸ Next Round</strong>：每轮结算后全员分别确认再继续，掉线不会自动确认。Private trades 保留本人参与的交易；Debts 可展开查看每张债务。</p>
            <p><strong>⭐ 计分</strong>：每个行业 n 个 = n(n+1)/2 分：0／1／2／3／4／5／6 个对应 0／1／3／6／10／15／21 分。基础模式现金 0–29／30–55／56–77／78–95／96+ 对应 0／1／2／3／4 分。同分时最大本金资金牌较高者胜，再同则共享胜利。全员破产时无人获胜。</p>
            <p><strong>💎 进阶</strong>：发起交易的机会可改为购买一件奢侈品：💍30→1分、🚘56→2分、🛥️78→3分、🏙️96→4分。每件唯一，不能转卖；进阶现金不计分。</p>
            <p><strong>版本</strong>：四类行业各 15 个，72 张资金牌（9 起始、47 普通、16 熊）。默认采用作者补充的首轮跳过交易；房间可开启 First-round trading。牌表来自可追溯的 MIT 许可转录，并核对规则书示例与作者勘误。</p>
            <p><strong>Controls</strong>：点选后 Confirm，点击空白或 Esc 取消；Close、Esc 或对话框外关闭弹窗。Explain 模式只展示说明，灰色按钮也可点，按 Esc 退出。</p>
            <p><a href="https://cdn.1j1ju.com/medias/0c/7f/67-ponzi-scheme-rulebook.pdf" target="_blank" rel="noopener noreferrer">Rulebook</a> · <a href="https://www.flyingv.cc/projects/4303/comments" target="_blank" rel="noopener noreferrer">Designer’s corrections</a></p>`, true);
    });
    explainButton.addEventListener("click", () => setExplain(!explaining));
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });

    function explainTarget(target) {
        const text = target && (target.dataset.psTip || explanations[target.dataset.psExplain]);
        if (text) { setExplain(false); openDialog("Explain", text); }
    }
    document.addEventListener("pointerdown", event => {
        if (!explaining || panel.classList.contains("hidden") || header.contains(event.target) || dialog.contains(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const target = Array.from(panel.querySelectorAll("[data-ps-explain]")).find(element => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        if (target) { suppressedPointer = {x: event.clientX, y: event.clientY, time: Date.now()}; explainTarget(target); }
    }, true);
    document.addEventListener("click", event => {
        if (suppressedPointer) {
            const point = suppressedPointer; suppressedPointer = null;
            if (Date.now() - point.time < 700 && Math.abs(event.clientX - point.x) < 6 && Math.abs(event.clientY - point.y) < 6) {
                event.preventDefault(); event.stopImmediatePropagation(); return;
            }
        }
        if (!explaining || header.contains(event.target) || dialog.contains(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (panel.contains(event.target)) explainTarget(event.target.closest("[data-ps-explain]"));
    }, true);
    panel.addEventListener("pointerdown", event => {
        if (!view || explaining || pending || event.ponziTipDismissed || event.target.closest("button, input, select, summary, a, dialog, label, [data-ps-tip]")) return;
        if (selectedCard || selectedIndustry || selectedTarget) { resetSelection(); render(); }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Tab") inputKind = "keyboard";
        if ((event.key === "Enter" || event.key === " ") && event.target.closest("[data-ps-tip]") && !explaining) {
            event.preventDefault(); showImmediateTip(event.target.closest("[data-ps-tip]")); return;
        }
        if (event.key === "Escape" && !immediateTip.hidden) { hideImmediateTip(); event.preventDefault(); return; }
        if (dialog.open) return;
        if (event.key === "Escape" && !panel.classList.contains("hidden")) { setExplain(false); resetSelection(); render(); }
    });

    document.addEventListener("pointerover", event => {
        if (event.pointerType === "touch" || event.pointerType === "pen" || explaining) return;
        if (immediateTip.contains(event.target) || tipAnchor?.contains(event.target)) window.clearTimeout(tipHideTimer);
        const target = event.target.closest("#ponziSchemePanel [data-ps-tip]");
        if (target && target !== tipAnchor) { inputKind = "mouse"; showImmediateTip(target); }
    });
    document.addEventListener("pointerout", event => {
        if (inputKind === "touch" || !tipAnchor) return;
        if ((tipAnchor.contains(event.target) || immediateTip.contains(event.target)) &&
            !tipAnchor.contains(event.relatedTarget) && !immediateTip.contains(event.relatedTarget)) tipHideTimer = window.setTimeout(hideImmediateTip, 160);
    });
    document.addEventListener("focusin", event => {
        const target = event.target.closest("#ponziSchemePanel [data-ps-tip]");
        if (target && inputKind !== "touch" && !explaining) showImmediateTip(target);
    });
    document.addEventListener("focusout", event => {
        if (inputKind !== "touch" && tipAnchor?.contains(event.target) && !immediateTip.contains(event.relatedTarget)) hideImmediateTip();
    });
    document.addEventListener("pointerdown", event => {
        if (explaining || panel.classList.contains("hidden")) return;
        const target = event.target.closest("#ponziSchemePanel [data-ps-tip]");
        inputKind = event.pointerType === "touch" || event.pointerType === "pen" ? "touch" : "mouse";
        if (target && inputKind === "touch") touchStart = {id: event.pointerId, target, x: event.clientX, y: event.clientY, time: Date.now(), moved: false};
        else if (!target && !immediateTip.contains(event.target) && !immediateTip.hidden) {
            event.ponziTipDismissed = true; hideImmediateTip();
        }
    }, true);
    document.addEventListener("pointermove", event => {
        if (touchStart?.id === event.pointerId && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) { touchStart.moved = true; hideImmediateTip(); }
    }, true);
    document.addEventListener("pointerup", event => {
        if (!touchStart || touchStart.id !== event.pointerId) return;
        const start = touchStart; touchStart = null;
        if (!start.moved && Date.now() - start.time < 700 && start.target.isConnected && !explaining) {
            event.preventDefault(); event.stopImmediatePropagation(); showImmediateTip(start.target, true);
        }
    }, true);
    document.addEventListener("pointercancel", () => { touchStart = null; }, true);
    document.addEventListener("click", event => {
        const target = event.target.closest("#ponziSchemePanel [data-ps-tip]");
        if (!target || explaining) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (inputKind !== "touch") showImmediateTip(target);
    }, true);
    window.addEventListener("resize", hideImmediateTip);
    document.addEventListener("scroll", () => { if (inputKind !== "touch") hideImmediateTip(); }, true);

    function clearState() {
        hideImmediateTip(); touchStart = null;
        view = null; signature = null; pending = false; suppressedPointer = null;
        resetSelection(); setExplain(false); openDetails.clear(); window.clearTimeout(pendingTimer);
        if (dialog.open) dialog.close();
        panel.innerHTML = "";
    }
    window.renderPonziSchemeGameState = data => {
        if (!data?.view) return;
        const next = data.view;
        const nextSignature = JSON.stringify([data.room_id, next.phase, next.round, next.current_turn, next.market.map(card => card.id)]);
        if (signature !== nextSignature) { resetSelection(); if (dialog.open && dialog.dataset.psKind === "purchase") dialog.close(); }
        signature = nextSignature; view = next; pending = false; window.clearTimeout(pendingTimer); render();
    };
    window.showPonziSchemeHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clearState();
    };
    window.clearPonziSchemeState = clearState;
    window.getPonziSchemeConfig = () => ({advanced: document.getElementById("ponziSchemeAdvanced").checked, first_round_trading: document.getElementById("ponziSchemeFirstTrade").checked});
    window.updatePonziSchemeConfigRow = () => {
        const box = document.getElementById("ponziSchemeConfigBox");
        const visible = currentGameType === "ponzi_scheme" && currentRoomState?.status === "lobby";
        box.classList.toggle("hidden", !visible); box.setAttribute("aria-hidden", String(!visible));
    };
    window.addEventListener("DOMContentLoaded", () => {
        socket.on("system:error", () => { if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); } });
    }, {once: true});
})();
