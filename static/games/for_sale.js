(() => {
    "use strict";

    const panel = document.getElementById("forSalePanel");
    const header = document.getElementById("forSaleHeaderActions");
    const helpButton = document.getElementById("forSaleHelpBtn");
    const explainButton = document.getElementById("forSaleExplainBtn");
    if (!panel || !header || !helpButton || !explainButton) return;

    const tiers = [
        ["⛺", "起步居所", "1–5"], ["🏡", "邻里小屋", "6–10"],
        ["🏘️", "宜居街区", "11–15"], ["🏢", "城市地标", "16–20"],
        ["🏛️", "典雅庄园", "21–25"], ["🏰", "梦想豪宅", "26–30"],
    ];
    const explanations = {
        property: "地产(🏠)共 30 张，价值从 1 到 30。买房时退出者依次拿走当前最低地产，最后留下者拿最高地产；售房时地产越高，获得的支票越高。卡面颜色与建筑图标只用于区分价值区间。",
        check: "支票(💵)为 0、2–15K 各两张。售房时，所有人同时揭示地产(🏠)，按地产从低到高分配本轮支票；相同支票金额没有额外差别。K 表示千元。",
        cash: "现金(🪙)是尚未押在本轮竞拍上的可用资金。3／4 人起始 18K，5／6 人起始 14K。其他人的现金在终局前保密，剩余现金会计入最终财富。K 表示千元。",
        bid: "Bid 按所选总价出价，必须高于当前最高出价。已经押出的金额不用重复支付，只补上差额。最高总价为你的剩余现金(🪙)加本轮已押金额。",
        amount: "选择本轮竞拍总价，单位为千元(K)，不是额外追加金额。−／＋每次调整 1K。总价必须大于当前最高出价，并且不超过你能支付的金额。",
        auction: "Still Bidding 列出本轮仍在竞拍的玩家，包括尚未出价的玩家。You 是自己，To act 是当前行动者，Highest 是目前最高出价者；已押(🪙)是各人公开的竞拍总价。Passed 列出已经退出、取得地产且不会再参与本轮加价的玩家。",
        pass: "Pass 退出本轮并取得当前最低地产(🏠)。已押金额的一半向下取整退回，其余支付。例如押 5K，退 2K、付 3K；尚未出价就退出则免费拿地产。最后留下者支付全部出价。",
        sell: "点选一张自己的地产(🏠)，再点击 Confirm Sale 秘密提交。所有人提交后同时揭示，并按地产价值分配支票(💵)。提交后锁定，不能改选。已售出的地产移出手牌。",
        next: "Next Round 表示你已经看过本轮结算。所有席位各自确认后才会继续，包括买卖阶段切换和最后排名。机器人只确认自身，断线真人仍需重连确认。",
        player: "玩家栏显示本轮公开出价、是否退出／提交，以及持有地产(🏠)和支票(💵)的数量。其他人的现金、私有地产、支票及尚未揭示的售房选择在终局前保密。",
        bot: "机器人(🤖)仅基于自己可见的信息决策，不读取其他人的私牌、秘密选择或未来牌库；轮末只会确认自己的席位。",
        held: "已押(🪙)是你本轮已投入的竞拍金额。加价只补差额；退出退回一半向下取整。最后留下者全部支付。",
        total: "总财富等于支票(💵)总额加剩余现金(🪙)。总财富最高者获胜；相同则现金多者胜，再相同则并列获胜。奖杯(🏆)表示胜者。",
        market: "每轮翻开与玩家人数相同的牌。先完成所有地产(🏠)竞拍，再进入支票(💵)售房阶段。买房时这里只保留尚未分配的地产；轮末查看完整成交结果。",
        result: "这里保留本轮所有成交结果。买房展示取得的地产(🏠)、总出价、实际支付及退款；售房展示公开的地产和对应支票(💵)。所有人确认后才进入下一轮。",
        log: "公开记录只包含竞拍、提交状态和已经公开的成交结果，不会揭露未公开的售房选择或私牌。该区域可单独滚动。",
        private: "私有资产(🔒)只有你能查看。保留的地产(🏠)用于售房；支票(💵)和剩余现金(🪙)在终局合计为总财富。",
    };
    let view = null, selected = null, bidAmount = 1, signature = null;
    let pending = false, pendingTimer = null, explaining = false, tipTimer = null;
    let returnFocus = null, suppressUntil = 0;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
    const money = value => `${Number(value) || 0}K`;
    const playerName = id => view?.players.find(player => player.player_id === id)?.name || "—";
    const allowed = action => !pending && view?.legal_actions.includes(action);
    const info = (text, key, detail = "") => `<span tabindex="0" data-fs-tip="${esc(detail || explanations[key])}" data-fs-explain="${esc(key)}">${text}</span>`;
    const sum = values => values.reduce((total, value) => total + value, 0);
    function detailFor(key) {
        if (!key?.startsWith("property-")) return explanations[key];
        const value = Number(key.slice(9));
        const [icon, title] = tiers[Math.max(0, Math.min(5, Math.floor((value - 1) / 5)))];
        return `地产(🏠) ${value} · ${title}(${icon})。${explanations.property}`;
    }

    const dialog = document.createElement("dialog");
    dialog.id = "forSaleDialog";
    dialog.className = "fs-dialog";
    dialog.setAttribute("aria-labelledby", "forSaleDialogTitle");
    dialog.innerHTML = '<div class="fs-dialog-heading"><h2 id="forSaleDialogTitle">Help</h2><button type="button">Close</button></div><div class="fs-dialog-body"></div>';
    document.body.append(dialog);
    const closeButton = dialog.querySelector("button");
    const tip = document.createElement("div");
    tip.className = "fs-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.append(tip);

    function hideTip() {
        tip.hidden = true;
        clearTimeout(tipTimer);
    }

    function showTip(anchor, temporary = false) {
        if (explaining || !anchor?.dataset.fsTip) return;
        hideTip();
        tip.textContent = anchor.dataset.fsTip;
        tip.hidden = false;
        const box = anchor.getBoundingClientRect(), size = tip.getBoundingClientRect();
        tip.style.left = `${Math.max(8, Math.min(box.left, innerWidth - size.width - 8))}px`;
        const top = box.top - size.height - 8 > 8 ? box.top - size.height - 8 : box.bottom + 8;
        tip.style.top = `${Math.max(8, Math.min(top, innerHeight - size.height - 8))}px`;
        if (temporary) tipTimer = setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        panel.classList.toggle("fs-explaining", enabled);
        explainButton.setAttribute("aria-pressed", String(enabled));
        explainButton.title = enabled ? "Choose an item to explain · Esc to exit" : "Explain";
        hideTip();
    }

    function openDialog(title, html) {
        hideTip();
        returnFocus = document.activeElement;
        dialog.querySelector("h2").textContent = title;
        dialog.querySelector(".fs-dialog-body").innerHTML = html;
        if (!dialog.open) dialog.showModal();
        closeButton.focus();
    }

    function openHelp() {
        setExplain(false);
        openDialog("Help · 地产达人", `
            <p>以低价买下地产(🏠)，再把它卖成支票(💵)。最终支票加现金(🪙)最多者获胜。本实现采用 Eagle-Gryphon 基础版，支持 3–6 人，不含顾问扩充。</p>
            <h3>准备</h3><p>地产为 1–30 各一张；支票为 0、2–15K 各两张，没有 1K 支票。3／4 人每人起始现金 18K，5／6 人为 14K。3 人局随机暗移除各 6 张地产和支票，4 人局各 2 张，5／6 人全部使用。两种牌分别洗混，首轮先手随机。K 表示千元。</p>
            <h3>第一阶段 · 买房</h3><p>每轮翻开人数张地产。从先手开始依座位轮流出价或退出。出价是本轮总价，必须超过当前最高价且不能超过自己的剩余现金与已押金额之和；之前押过的部分不再重复支付。</p>
            <p>${explanations.auction}</p>
            <p>${explanations.pass} 最后留下的人取得本轮最高地产，并成为下一轮先手。所有地产分配完后进入售房。</p>
            <h3>第二阶段 · 售房</h3><p>每轮翻开人数张支票。每位玩家秘密选择一张自己的地产，提交后不能更改。所有人提交后同时揭示，最低地产取得最低支票，依此类推；相同金额的支票效果相同。用过的地产移出手牌，得到的支票保留到终局。</p>
            <h3>结算与胜利</h3><p>${explanations.next} 所有地产售完后展示最终排名。${explanations.total}</p>
            <h3>隐私与图标</h3><p>${explanations.player} 私有资产(🔒)只显示给自己。${explanations.property} 卡面建筑图标为起步居所(⛺)、邻里小屋(🏡)、宜居街区(🏘️)、城市地标(🏢)、典雅庄园(🏛️)、梦想豪宅(🏰)；它们没有独立能力。机器人(🤖)仅使用自己可见的信息。</p>
            <h3>Controls</h3><p>买房用 −／＋或数字框选择总价，再点击 Bid；Pass 退出竞拍。售房点选地产，再点击 Confirm Sale。点击空白处或按 Esc 取消未提交的选择；提交后锁定。Explain 后点选任意高亮元素查看说明，包括禁用按钮。非操作图标可用鼠标悬停、键盘聚焦或触屏点击查看提示；触屏提示三秒后消失。Esc 或点击对话框外侧可关闭对话框。</p>`);
    }

    function propertyCard(value, selectable = false) {
        const tier = Math.max(0, Math.min(5, Math.floor((value - 1) / 5)));
        const [icon, title] = tiers[tier];
        const body = `<span class="fs-card-top"><b>${value}</b><small>PROPERTY</small></span><span class="fs-building" aria-hidden="true">${icon}</span><span class="fs-card-name">${title}</span><span class="fs-card-foot">${String(value).padStart(2, "0")} / 30</span>`;
        return selectable
            ? `<button type="button" class="fs-property fs-tier-${tier} ${selected === value ? "is-selected" : view.your_selection === value ? "is-submitted" : ""}" data-fs-property="${value}" data-fs-explain="property-${value}" aria-label="地产 ${value}，${title}" aria-pressed="${selected === value}" ${!allowed("sell") ? "disabled" : ""}>${body}</button>`
            : `<div class="fs-property fs-tier-${tier}" tabindex="0" data-fs-explain="property-${value}" data-fs-tip="${esc(`地产(🏠) ${value}：${title}(${icon})。${explanations.property}`)}" aria-label="地产 ${value}，${title}">${body}</div>`;
    }

    function renderMarket() {
        if (view.phase === "round_end" || view.game_over) return "";
        const buying = view.stage === "buy";
        return `<section class="fs-box fs-market-box"><div class="fs-section-heading"><h3>${buying ? "Property Auction" : "The Check Market"}</h3>${info(buying ? `🏠 ${view.market_properties.length} available` : `💵 ${view.market_checks.length} checks`, "market")}</div>
            <div class="fs-market ${buying ? "" : "fs-check-market"}">${buying ? view.market_properties.map(value => propertyCard(value)).join("") : view.market_checks.map(value => `<div class="fs-check ${value === 0 ? "fs-zero-check" : ""}" tabindex="0" data-fs-explain="check" data-fs-tip="${esc(explanations.check)}"><span class="fs-check-top">💵 <small>BANK CHECK</small></span><strong>${money(value)}</strong><span class="fs-check-line"></span><small>PAY TO THE OWNER</small></div>`).join("")}</div>
            ${buying ? `<div class="fs-auction-line">${info("Current Bid", "bid")}<strong>${money(view.high_bid)}</strong><span>${esc(view.high_bidder ? playerName(view.high_bidder) : "No bids yet")}</span></div>` : `<div class="fs-auction-line">${info("🔒 Secret selection", "sell")}<span>Submitted <b>${view.players.filter(player => player.submitted).length} / ${view.players.length}</b></span></div>`}
            ${buying ? renderAuctionRoster() + renderBidControls() : ""}</section>`;
    }

    function renderAuctionRoster() {
        if (view.phase !== "buy") return "";
        const active = new Set(view.active_players);
        const bidders = view.players.filter(player => active.has(player.player_id));
        const passed = view.players.filter(player => !active.has(player.player_id));
        return `<div class="fs-auction-roster" data-fs-explain="auction">
            <div class="fs-auction-roster-heading"><strong>${info("Still Bidding", "auction")}</strong><span>${bidders.length} / ${view.players.length}</span></div>
            <ul class="fs-bidders" aria-label="Still bidding">${bidders.map(player => {
                const current = player.player_id === view.current_turn;
                const highest = view.high_bid > 0 && player.player_id === view.high_bidder;
                const own = player.player_id === view.you;
                const detail = `${player.name}${own ? "（你）" : ""}：仍在竞拍，已押(🪙) ${money(player.bid)}。${current ? "当前轮到此玩家行动。" : ""}${highest ? "目前出价最高。" : ""}`;
                return `<li class="fs-bidder ${current ? "is-current" : ""}" data-fs-bidder="${esc(player.player_id)}" tabindex="0" data-fs-tip="${esc(detail)}" data-fs-explain="auction">
                    <strong class="fs-bidder-name">${esc(player.name)}${own ? ' <small>You</small>' : ""}</strong>
                    <div class="fs-bidder-meta"><span>🪙 ${money(player.bid)}</span>${current ? '<b class="fs-bidder-turn">To act</b>' : ""}${highest ? '<b class="fs-bidder-highest">Highest</b>' : ""}</div>
                </li>`;
            }).join("")}</ul>
            ${passed.length ? `<div class="fs-auction-passed"><b>Passed</b><span>${passed.map(player => `${esc(player.name)}${player.player_id === view.you ? " (You)" : ""}`).join(" · ")}</span></div>` : ""}
        </div>`;
    }

    function renderBidControls() {
        const canBid = allowed("bid"), canPass = allowed("pass");
        const bidValid = Number.isInteger(bidAmount) && bidAmount >= view.min_bid && bidAmount <= view.max_bid;
        const own = view.players.find(player => player.player_id === view.you);
        if (!own) return '<p class="fs-muted">Spectating · 等待玩家完成竞拍</p>';
        if (!canBid && !canPass && !pending) return `<p class="fs-muted">${own.passed ? "你已取得本轮地产，等待其他玩家完成竞拍。" : `等待 ${esc(playerName(view.current_turn))} 行动。`}</p>`;
        return `<div class="fs-bid-controls"><div class="fs-bid-amount"><label for="forSaleBidAmount">Total Bid <small>(K)</small></label><div class="fs-stepper"><button type="button" data-fs-action="decrease" data-fs-explain="amount" aria-label="Decrease bid" ${!canBid || bidAmount <= view.min_bid ? "disabled" : ""}>−</button><input id="forSaleBidAmount" type="number" inputmode="numeric" step="1" min="${view.min_bid}" max="${view.max_bid}" value="${bidAmount}" data-fs-explain="amount" ${!canBid ? "disabled" : ""}><button type="button" data-fs-action="increase" data-fs-explain="amount" aria-label="Increase bid" ${!canBid || bidAmount >= view.max_bid ? "disabled" : ""}>+</button></div></div>
            <div class="fs-bid-actions"><button type="button" class="fs-primary" data-fs-action="bid" data-fs-explain="bid" ${!canBid || !bidValid ? "disabled" : ""}>${pending ? "Sending…" : "Bid"}</button><button type="button" data-fs-action="pass" data-fs-explain="pass" ${!canPass ? "disabled" : ""}>Pass</button></div></div>
            <div class="fs-bid-costs"><span data-fs-additional>${canBid ? `补差额 ${money(Math.max(0, bidAmount - view.your_bid))}` : "现金不足以加价"}</span>${info(`退出支付 ${money(Math.ceil(view.your_bid / 2))} · 退回 ${money(Math.floor(view.your_bid / 2))}`, "pass")}</div>`;
    }

    function renderPortfolio() {
        if (!view.players.some(player => player.player_id === view.you)) return "";
        const selling = view.phase === "sell";
        const cash = view.your_cash ?? 0, checks = sum(view.your_checks);
        return `<section class="fs-box fs-portfolio"><div class="fs-section-heading"><h3>Your Portfolio</h3>${info("🔒 Private", "private")}</div>
            <div class="fs-finances"><div>${info("🪙 Cash", "cash")}<strong>${money(cash)}</strong></div><div>${info("🪙 Held", "held")}<strong>${money(view.your_bid)}</strong></div><div>${info("💵 Checks", "check")}<strong>${money(checks)}</strong></div></div>
            ${view.your_properties.length ? `<div class="fs-hand">${view.your_properties.slice().sort((a, b) => a - b).map(value => propertyCard(value, selling)).join("")}</div>` : '<p class="fs-muted">暂无地产 · 你的地产会收藏在这里。</p>'}
            ${selling ? `<div class="fs-sale-confirm"><span>${view.your_selection !== null ? info(`🔒 地产 ${view.your_selection} 已提交`, "sell") : selected !== null ? `已选择地产 ${selected}` : "选择一张地产出售"}</span><button type="button" class="fs-primary" data-fs-action="sell" data-fs-explain="sell" ${!allowed("sell") || selected === null ? "disabled" : ""}>${pending ? "Sending…" : view.your_selection !== null ? "Submitted" : "Confirm Sale"}</button></div>` : ""}
            ${view.your_checks.length ? `<div class="fs-owned-checks">${view.your_checks.map(value => info(`💵 ${money(value)}`, "check")).join("")}</div>` : ""}</section>`;
    }

    function renderPlayers() {
        return `<section class="fs-box"><div class="fs-section-heading"><h3>At the Table</h3>${info(`${view.players.length} players`, "player")}</div><div class="fs-players">${view.players.map(player => {
            const own = player.player_id === view.you;
            const current = view.phase === "buy" && player.player_id === view.current_turn;
            let status = view.game_over ? `总财富 ${money(player.total)}`
                : view.phase === "round_end" ? (view.next_ready.includes(player.player_id) ? "Ready" : "Reviewing")
                : view.stage === "sell" ? (player.submitted ? "Submitted" : "Choosing")
                : player.passed ? "Passed" : current ? "Bidding" : "Waiting";
            return `<article class="fs-player ${current ? "is-current" : ""} ${player.passed && view.stage === "buy" ? "is-passed" : ""}"><div class="fs-player-heading"><strong>${esc(player.name)}${own ? " <small>You</small>" : ""}</strong>${player.is_bot ? info("🤖", "bot") : ""}</div><div class="fs-player-line"><span class="fs-player-status">${status}</span>${view.stage === "buy" && !view.game_over ? info(`🪙 ${money(player.bid)}`, "bid") : ""}</div><div class="fs-player-assets">${info(`🏠 ${player.property_count}`, "player", "持有地产(🏠)的数量；未售出的具体地产只对本人可见。")}${info(`💵 ${player.check_count}`, "player", "持有支票(💵)的张数；金额只对本人可见，终局公开合计。")}${player.cash !== null ? info(`🪙 ${money(player.cash)}`, "cash") : info("🔒 Private", "private")}</div></article>`;
        }).join("")}</div></section>`;
    }

    function renderResult() {
        const summary = view.round_summary;
        if (!summary || view.game_over) return "";
        const buying = summary.stage === "buy";
        return `<section class="fs-box fs-review"><div class="fs-section-heading"><h3>Round Review</h3>${info(buying ? "🏠 买房成交" : "💵 售房成交", "result")}</div>
            <div class="fs-result-list">${summary.rows.map(row => `<div class="fs-result-row"><strong>${esc(playerName(row.player_id))}${row.player_id === view.you ? " <small>You</small>" : ""}</strong><div class="fs-result-detail">${info(`🏠 ${row.property}`, `property-${row.property}`, detailFor(`property-${row.property}`))}${buying ? `<b>支付 ${money(row.paid)}</b><small>出价 ${money(row.bid)} · 退款 ${money(row.refund)}</small>` : `<b>${info(`💵 ${money(row.check)}`, "check")}</b>`}</div></div>`).join("")}</div>
            ${summary.winner ? `<p class="fs-muted">${esc(playerName(summary.winner))} 留到最后，获得最高地产。</p>` : ""}
            <div class="fs-sale-confirm"><span>Ready <b>${view.next_ready.length} / ${view.players.length}</b></span><button type="button" class="fs-primary" data-fs-action="next" data-fs-explain="next" ${!allowed("next_round") ? "disabled" : ""}>${pending ? "Sending…" : view.next_ready.includes(view.you) ? "Waiting…" : "Next Round"}</button></div></section>`;
    }

    function renderFinal() {
        if (!view.game_over) return "";
        const winners = view.final_results.filter(row => row.rank === 1).map(row => playerName(row.player_id));
        return `<section class="fs-box fs-final"><span class="fs-eyebrow">THE FINAL VALUATION</span><h3>${info("🏆", "total")} ${esc(winners.join(" / "))}</h3><p class="fs-muted">${winners.length > 1 ? "并列获胜" : "地产达人"} · 所有资产已完成结算</p><div class="fs-ranking">${view.final_results.map(row => `<div class="fs-rank-row ${row.rank === 1 ? "is-winner" : ""}"><span class="fs-rank">${row.rank}</span><div><strong>${esc(playerName(row.player_id))}${row.player_id === view.you ? " <small>You</small>" : ""}</strong><div class="fs-final-breakdown">${info(`💵 ${money(row.checks)}`, "check")}${info(`🪙 ${money(row.cash)}`, "cash")}</div></div><b>${info(money(row.total), "total")}</b></div>`).join("")}</div></section>`;
    }

    function statusText() {
        if (view.game_over) return "对局结束 · 查看最终排名";
        if (pending) return "Sending…";
        if (!view.players.some(player => player.player_id === view.you)) return "Spectating · 观看本轮公开行动";
        if (view.phase === "round_end") return view.next_ready.includes(view.you) ? "已确认 · 等待其他玩家查看结果" : "本轮已结算 · 查看成交后点击 Next Round";
        if (view.stage === "buy") return view.current_turn === view.you ? "轮到你了 · 加价竞拍，或退出取得最低地产" : `等待 ${playerName(view.current_turn)} 竞拍`;
        return view.your_selection !== null ? "已秘密提交 · 等待所有玩家同时揭示" : "选择一张地产 · 争取最有价值的支票";
    }

    function render() {
        if (!view) return;
        const logScroll = panel.querySelector(".fs-log")?.scrollTop || 0;
        panel.innerHTML = `<div class="fs-surface"><div class="fs-banner"><div><span class="fs-eyebrow">SMALL BIDS. GRAND AMBITIONS.</span><h2>地产达人 <small>For Sale</small></h2></div><div class="fs-phase-label"><b>${view.stage === "buy" ? "01 · BUY" : "02 · SELL"}</b><span>Round ${view.stage_round} / ${view.rounds_per_stage}</span></div></div>
            <div class="fs-stage-track"><span class="${view.stage === "buy" ? "is-active" : ""}">01 买入地产</span><span class="fs-track-line" aria-hidden="true"></span><span class="${view.stage === "sell" ? "is-active" : ""}">02 售出获利</span></div>
            <div class="fs-status" role="status" aria-live="polite">${esc(statusText())}</div><div class="fs-layout"><div class="fs-main">${renderFinal()}${renderResult()}${renderMarket()}${renderPortfolio()}</div><aside class="fs-sidebar">${renderPlayers()}<section class="fs-box fs-log-box"><div class="fs-section-heading"><h3>Activity</h3>${info("Public log", "log")}</div><div class="fs-log">${view.log.slice().reverse().map(entry => `<p><small>R${entry.round}</small><span>${esc(entry.text)}</span></p>`).join("") || '<p class="fs-muted">No activity yet.</p>'}</div></section></aside></div></div>`;
        panel.querySelector(".fs-log").scrollTop = logScroll;
    }

    function submit(action) {
        if (pending) return;
        pending = true;
        hideTip();
        render();
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pending = false; render(); }, 5000);
        sendAction(action);
    }

    function updateBidInput(event) {
        if (event.target.id !== "forSaleBidAmount" || !view) return;
        const value = event.target.valueAsNumber;
        const valid = Number.isInteger(value) && value >= view.min_bid && value <= view.max_bid;
        if (valid) bidAmount = value;
        const bidButton = panel.querySelector('[data-fs-action="bid"]');
        if (bidButton) bidButton.disabled = !valid || !allowed("bid");
        panel.querySelector('[data-fs-action="decrease"]').disabled = !allowed("bid") || !valid || value <= view.min_bid;
        panel.querySelector('[data-fs-action="increase"]').disabled = !allowed("bid") || !valid || value >= view.max_bid;
        panel.querySelector("[data-fs-additional]").textContent = valid ? `补差额 ${money(Math.max(0, value - view.your_bid))}` : `请输入 ${view.min_bid}–${view.max_bid}K 的整数`;
    }

    panel.addEventListener("input", updateBidInput);
    panel.addEventListener("click", event => {
        if (explaining || !view) return;
        const button = event.target.closest("button");
        if (button && !button.disabled) {
            const action = button.dataset.fsAction;
            if (button.dataset.fsProperty && allowed("sell")) {
                const property = Number(button.dataset.fsProperty);
                selected = selected === property ? null : property;
                hideTip(); render();
            } else if ((action === "decrease" || action === "increase") && allowed("bid")) {
                bidAmount = Math.max(view.min_bid, Math.min(view.max_bid, bidAmount + (action === "increase" ? 1 : -1)));
                render();
                panel.querySelector(`[data-fs-action="${action}"]`)?.focus();
            } else if (action === "bid" && allowed("bid")) {
                const amount = panel.querySelector("#forSaleBidAmount")?.valueAsNumber;
                if (Number.isInteger(amount) && amount >= view.min_bid && amount <= view.max_bid) submit({type: "bid", round: view.round, turn: view.turn, amount});
            } else if (action === "pass" && allowed("pass")) submit({type: "pass", round: view.round, turn: view.turn});
            else if (action === "sell" && allowed("sell") && selected !== null) submit({type: "sell", round: view.round, property: selected});
            else if (action === "next" && allowed("next_round")) submit({type: "next_round", round: view.round});
            return;
        }
        const anchor = event.target.closest("[data-fs-tip]");
        if (anchor) showTip(anchor, true);
        else if (!event.target.closest("button, input, label") && selected !== null && !pending) { selected = null; hideTip(); render(); }
    });

    function explainAt(event) {
        const button = event.target.closest("button, input");
        let element = button ? (button.matches("[data-fs-explain]") ? button : null) : event.target.closest("[data-fs-explain]");
        if (event.type === "pointerdown") {
            const disabled = [...panel.querySelectorAll(":disabled[data-fs-explain]")].find(item => {
                const rect = item.getBoundingClientRect();
                return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
            });
            if (disabled) element = disabled;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (element && detailFor(element.dataset.fsExplain)) {
            const detail = detailFor(element.dataset.fsExplain);
            setExplain(false);
            if (event.type === "pointerdown") suppressUntil = performance.now() + 700;
            openDialog("Explain", `<p>${esc(detail)}</p>`);
        }
    }

    document.addEventListener("pointerdown", event => {
        if (!explaining || event.target.closest("#forSaleHelpBtn, #forSaleExplainBtn, .fs-dialog")) return;
        explainAt(event);
    }, true);
    document.addEventListener("click", event => {
        if (performance.now() < suppressUntil) {
            suppressUntil = 0; event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (!explaining || event.target.closest("#forSaleHelpBtn, #forSaleExplainBtn, .fs-dialog")) return;
        explainAt(event);
    }, true);
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-fs-tip]")); });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-fs-tip]")));
    panel.addEventListener("focusout", hideTip);
    panel.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-fs-tip]")) {
            event.preventDefault();
            if (explaining) explainAt(event);
            else showTip(event.target, true);
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        setExplain(false); hideTip();
        if (!dialog.open && selected !== null && !pending) { selected = null; render(); }
    });
    helpButton.addEventListener("click", openHelp);
    explainButton.addEventListener("click", () => setExplain(!explaining));
    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    document.addEventListener("scroll", hideTip, true);

    window.renderForSaleGameState = data => {
        const next = data.view;
        if (!next || next.game_id !== "for_sale") return;
        const nextSignature = JSON.stringify([data.room_id, next.you, next.round, next.turn, next.phase]);
        if (signature !== nextSignature) { selected = null; bidAmount = next.min_bid; hideTip(); }
        if (!next.your_properties.includes(selected) || next.your_selection !== null) selected = null;
        signature = nextSignature;
        view = next;
        bidAmount = Math.max(next.min_bid, Math.min(next.max_bid, bidAmount));
        pending = false;
        clearTimeout(pendingTimer);
        render();
    };
    window.showForSaleHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) {
            view = null; signature = null; selected = null; pending = false; suppressUntil = 0;
            clearTimeout(pendingTimer);
            setExplain(false); hideTip();
            if (dialog.open) dialog.close();
            panel.innerHTML = "";
        }
    };
    function connectEvents() {
        if (typeof socket !== "undefined") socket.on("system:error", () => {
            if (pending) { pending = false; clearTimeout(pendingTimer); render(); }
        });
    }
    if (document.readyState === "loading" || typeof socket === "undefined") window.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    else connectEvents();
})();
