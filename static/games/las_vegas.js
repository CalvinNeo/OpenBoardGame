(() => {
    "use strict";

    const panel = document.getElementById("lasVegasPanel");
    const content = document.getElementById("lasVegasContent");
    const header = document.getElementById("lasVegasHeaderActions");
    const helpButton = document.getElementById("lasVegasHelpBtn");
    const explainButton = document.getElementById("lasVegasExplainBtn");
    const dialog = document.getElementById("lasVegasDialog");
    const closeButton = document.getElementById("lasVegasDialogClose");
    const tip = document.getElementById("lasVegasTooltip");
    const setup = document.getElementById("lasVegasSetup");
    const neutralCheckbox = document.getElementById("lasVegasNeutralDice");
    if (!panel || !content || !header || !helpButton || !explainButton || !dialog) return;

    const explanations = {
        casino: "赌场(🎰)分别对应骰子点数 1–6。把选定点数的全部骰子(🎲)放到对应赌场。每轮各赌场至少提供 $50,000 的钞票(💵)；按最终骰子排名，每个有效参与者最多取得一张钞票。",
        roll: "Roll Dice 掷出你所有剩余的骰子(🎲)，包括白骰变体中的白骰(⚪)。每回合只能掷一次，然后必须选择一个掷出的点数。",
        place: "Place Dice 将所选点数的全部骰子(🎲)放入对应赌场(🎰)，同点白骰(⚪)也必须一起放。可以只放白骰；不能留下相同点数的骰子。选中后可预览放置后的奖金，确认后轮到下一位。",
        face: "选择一个本次掷出的点数，再点击 Place Dice 确认。所有该点数的骰子(🎲)，包括白骰(⚪)，都必须一起放置。点击空白处或按 Esc 取消尚未提交的选择。",
        dice: "骰子(🎲)：每人每轮拥有 8 枚自己的骰子。每回合掷出全部剩余骰子，选择一个点数全部放入同号赌场。颜色对应玩家，骰子数量决定赌场排名。",
        neutral: "白骰(⚪)是独立的中立参与者，所有玩家放出的白骰合并计数，并且参与平手与排名。中立方拿到的奖金回到牌库底。2 人每人加 4 枚白骰；3／4 人每人加 2 枚。3 人局每轮先自动投放另外 2 枚白骰。",
        money: "钞票(💵)的面额为 $10,000–$90,000，共 54 张。每轮按赌场顺序发到各自至少 $50,000。结算时，骰子数最多的有效参与者拿最高面额的一张，依此类推。K 表示千美元。",
        ties: "平手取消(✕)：同一赌场里，骰子数量相同的所有参与者都取消领奖资格，包括低位平手和白骰(⚪)。剩下的参与者按骰子数从多到少领奖；无人领取的钞票(💵)回到牌库底。",
        payout: "奖金预览(💵)按当前盘面的骰子数计算；选中点数后，该赌场显示放置后的预计结果。所有人用完骰子前，奖金归属仍可能改变。轮末才正式支付，每位有效参与者每个赌场最多拿一张钞票。",
        returned: "回收(↩)：没有有效玩家领取的钞票(💵)，以及中立方(⚪)取得的钞票，都会回到牌库底。这里保留结算时的金额快照，不代表仍可领取。",
        player: "玩家栏显示剩余骰子(🎲)、持有钞票(💵)张数和当前行动者。赢得的钞票面朝下保存，其他人的金额在终局前保密。玩家颜色仅用于辨认，姓名始终同时显示。",
        private: "私有奖金(🔒)：只有你能查看自己的钞票(💵)面额和累计金额。其他玩家只能看到张数；已公开的历史收入仍可在 Activity 中查看。",
        next: "Next Round 表示你已看完本轮结算。所有席位分别确认后才能继续，第四轮也需要全员确认后进入终局。机器人(🤖)只确认自身，断线真人需重连确认。",
        total: "胜者(🏆)为 4 轮后累计奖金(💵)最多的玩家；金额相同则钞票张数更多者胜，再相同则并列获胜。",
        bot: "机器人(🤖)只根据自己的公开视图选择行动，不读取其他人的私有钞票或未来牌库；轮末只确认自己的席位。",
        round: "整场共 4 轮，每轮所有人重新取得自己的 8 枚骰子(🎲)。首轮先手随机，之后每轮先手按座位轮转；用完骰子的玩家自动跳过。",
        log: "Activity 保留已经公开的掷骰、放置和奖金分配记录，不公开未来牌库。此区域可以单独滚动。",
    };
    const pipPositions = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    let view = null, selected = null, signature = null, configSignature = null;
    let pending = false, pendingTimer = null, explaining = false, tipTimer = null;
    let returnFocus = null, suppressUntil = 0;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
    const money = value => `$${(Number(value) || 0).toLocaleString("en-US")}`;
    const shortMoney = value => `$${(Number(value) || 0) / 1000}K`;
    const sum = values => values.reduce((total, value) => total + value, 0);
    const player = id => view?.players.find(item => item.player_id === id);
    const playerName = id => id === "__neutral__" ? "白骰" : player(id)?.name || "—";
    const playerColor = id => id === "__neutral__" ? "neutral" : Math.max(0, Math.min(4, Number(player(id)?.color) || 0));
    const allowed = action => !pending && (view?.legal_actions || []).includes(action);
    const info = (html, key, text = "") => `<span tabindex="0" data-lv-tip="${esc(text || explanations[key])}" data-lv-explain="${key}">${html}</span>`;
    const dice = (face, color = "neutral", extra = "") => `<span class="lv-die lv-color-${color} ${extra}" aria-hidden="true">${Array.from({length: 9}, (_, index) => `<i class="${pipPositions[face]?.includes(index) ? "is-pip" : ""}"></i>`).join("")}</span>`;
    const rollCount = face => (view?.roll?.own || []).filter(value => value === face).length + (view?.roll?.neutral || []).filter(value => value === face).length;

    function hideTip() {
        tip.hidden = true;
        clearTimeout(tipTimer);
    }

    function showTip(anchor, temporary = false) {
        if (explaining || dialog.open || !anchor?.dataset.lvTip) return;
        hideTip();
        tip.textContent = anchor.dataset.lvTip;
        tip.hidden = false;
        const box = anchor.getBoundingClientRect(), size = tip.getBoundingClientRect();
        tip.style.left = `${Math.max(8, Math.min(box.left, innerWidth - size.width - 8))}px`;
        const top = box.top - size.height - 8 > 8 ? box.top - size.height - 8 : box.bottom + 8;
        tip.style.top = `${Math.max(8, Math.min(top, innerHeight - size.height - 8))}px`;
        if (temporary) tipTimer = setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        panel.classList.toggle("lv-explaining", enabled);
        explainButton.setAttribute("aria-pressed", String(enabled));
        explainButton.title = enabled ? "Choose an item to explain · Esc to exit" : "Explain";
        hideTip();
    }

    function openDialog(title, html) {
        hideTip();
        returnFocus = document.activeElement;
        document.getElementById("lasVegasDialogTitle").textContent = title;
        document.getElementById("lasVegasDialogBody").innerHTML = html;
        if (!dialog.open) dialog.showModal();
        closeButton.focus();
    }

    function openHelp() {
        setExplain(false);
        openDialog("Help · 拉斯维加斯", `
            <p>在 6 个赌场(🎰)投放骰子(🎲)，争取钞票(💵)。玩 4 轮，累计奖金最多者获胜。采用 Ravensburger / alea 2012 基础版规则，支持 2–5 人。</p>
            <h3>准备与回合</h3><p>每人每轮 8 枚自己的骰子，首轮先手随机，以后每轮先手按座位轮转。54 张钞票洗混：$10,000／$40,000／$50,000 各 6 张，$20,000／$30,000 各 8 张，$60,000／$70,000／$80,000／$90,000 各 5 张。每轮按赌场 1–6 顺序发钞票，直到各赌场至少有 $50,000。</p>
            <p>轮到你时，Roll Dice 掷出全部剩余骰子，选择一个点数，再用 Place Dice 把该点数的全部骰子放入同号赌场。不能只放一部分，也不能重新掷骰或跳过。轮到下一位仍有骰子的玩家，直至所有人放完。</p>
            <h3>平手与领奖</h3><p>${explanations.ties} 有效参与者按骰子数从多到少，依次取得赌场剩余最高面额的一张钞票，直到钞票或参与者用完。例如骰子数为 5、3、3、1 时，两个 3 同时取消资格，5 和 1 依次领奖。</p>
            <p>钞票面朝下保留，自己可查看面额和总额，其他人只见张数。公开领取奖金的历史仍可查看。${explanations.next} ${explanations.total}</p>
            <h3>可选白骰变体 · 2–4 人</h3><p>${explanations.neutral} 白骰与自己的骰子一起掷，同点数必须一起放；允许只放白骰。白骰不属于投放它的玩家，所有白骰合并成一个中立参与者。</p>
            <h3>图标与 Controls</h3><p>骰子(🎲)表示剩余数量，钞票(💵)表示奖金，私有奖金(🔒)只对自己可见，平手取消(✕)不能领奖，回收(↩)表示回牌库，胜者(🏆)表示最终第一名。K 表示千美元。${explanations.bot}</p>
            <p>选择掷骰区的点数或相应赌场，再点击 Place Dice。点击空白处或按 Esc 取消未提交的点数。Help 查看规则；Explain 后点选虚线元素查看解释，禁用按钮也支持。鼠标悬停、键盘聚焦或手机点击信息可查看提示；手机提示 3 秒后消失。Esc 或点击弹窗外侧可关闭弹窗。</p>`);
    }

    function projectedCasino(casino) {
        if (selected !== casino.face || !allowed("place")) return casino;
        const counts = {...casino.dice};
        counts[view.you] = (counts[view.you] || 0) + view.roll.own.filter(face => face === selected).length;
        const neutral = casino.neutral_dice + view.roll.neutral.filter(face => face === selected).length;
        const participants = Object.entries(counts).filter(([, count]) => count > 0);
        if (neutral > 0) participants.push(["__neutral__", neutral]);
        const ties = participants.filter(([, count]) => participants.filter(([, other]) => count === other).length > 1).map(([id]) => id);
        const ranked = participants.filter(([id]) => !ties.includes(id)).sort((a, b) => b[1] - a[1]);
        const notes = casino.banknotes.slice().sort((a, b) => b - a);
        return {...casino, dice: counts, neutral_dice: neutral, tied_players: ties, payouts: ranked.slice(0, notes.length).map(([id, count], index) => ({player_id: id, dice: count, amount: notes[index]}))};
    }

    function renderCasino(original) {
        const casino = projectedCasino(original);
        const preview = selected === casino.face && allowed("place");
        const canSelect = allowed("place") && rollCount(casino.face) > 0;
        const occupants = view.players.filter(item => casino.dice[item.player_id] > 0).map(item => [item.player_id, casino.dice[item.player_id]]);
        if (casino.neutral_dice > 0) occupants.push(["__neutral__", casino.neutral_dice]);
        occupants.sort((a, b) => b[1] - a[1]);
        const settled = view.phase === "round_end" || view.game_over;
        const snapshot = view.round_summary?.casinos.find(item => item.face === casino.face);
        return `<article class="lv-casino ${preview ? "is-selected" : ""}">
            <div class="lv-casino-heading"><button type="button" class="lv-casino-select" data-lv-face="${casino.face}" data-lv-explain="casino" aria-label="Casino ${casino.face}${canSelect ? ', select dice' : ''}" aria-pressed="${preview}" ${!canSelect ? "disabled" : ""}>${dice(casino.face)}<span><small>CASINO</small><b>${String(casino.face).padStart(2, "0")}</b></span></button><strong class="lv-prize">${info(shortMoney(sum(casino.banknotes)), "money")}</strong></div>
            <div class="lv-banknotes">${casino.banknotes.slice().sort((a, b) => b - a).map(note => info(`<span class="lv-banknote">💵 ${shortMoney(note)}</span>`, "money")).join("")}</div>
            <div class="lv-casino-label">${preview ? "After placement" : settled ? "Final allocation" : "Current payout"}${preview ? info("预览", "payout") : ""}</div>
            <div class="lv-occupants">${occupants.map(([id, count]) => {
                const tied = casino.tied_players.includes(id), payout = casino.payouts.find(item => item.player_id === id);
                return `<div class="lv-occupant ${tied ? "is-tied" : ""}"><span class="lv-player-dot lv-color-${playerColor(id)}" aria-hidden="true"></span><span class="lv-occupant-name">${esc(playerName(id))}</span>${info(`<b class="lv-dice-count">${count}🎲</b>`, id === "__neutral__" ? "neutral" : "dice")}<span class="lv-payout">${tied ? info("✕ 平手", "ties") : payout ? info(`${id === "__neutral__" ? "↩ " : ""}${shortMoney(payout.amount)}`, id === "__neutral__" ? "returned" : "payout") : info("—", "payout", "有效参与者超过钞票(💵)张数，因此当前没有可分配奖金。")}</span></div>`;
            }).join("") || '<div class="lv-empty-casino">等待骰子入场</div>'}</div>
            ${settled && snapshot?.returned.length ? `<div class="lv-returned">${info(`↩ 回收 ${snapshot.returned.map(shortMoney).join(" · ")}`, "returned")}</div>` : ""}
        </article>`;
    }

    function renderControls() {
        if (view.phase === "round_end" || view.game_over) return "";
        const hasRoll = view.phase === "place";
        const own = player(view.you);
        return `<section class="lv-box lv-controls"><div class="lv-section-heading"><h3>${hasRoll ? "Choose Your Dice" : "Your Next Move"}</h3>${info(`${view.current_turn === view.you ? "Your turn" : esc(playerName(view.current_turn))}`, "round")}</div>
            ${hasRoll ? `<div class="lv-roll-tray">${[1, 2, 3, 4, 5, 6].filter(face => rollCount(face)).map(face => {
                const ownCount = view.roll.own.filter(value => value === face).length;
                const neutralCount = view.roll.neutral.filter(value => value === face).length;
                return `<button type="button" class="lv-roll-group ${selected === face ? "is-selected" : ""}" data-lv-face="${face}" data-lv-explain="face" aria-label="点数 ${face}，${ownCount} 枚玩家骰子，${neutralCount} 枚白骰" aria-pressed="${selected === face}" ${!allowed("place") ? "disabled" : ""}>${dice(face, playerColor(view.current_turn))}<span class="lv-roll-counts">${ownCount ? `<b>${ownCount}🎲</b>` : ""}${neutralCount ? `<b class="lv-neutral-count">${neutralCount}⚪</b>` : ""}</span></button>`;
            }).join("")}</div>` : `<div class="lv-roll-rest">${dice(5, playerColor(view.current_turn))}<div><strong>${view.current_turn === view.you ? `${(own?.remaining || 0) + (own?.neutral_remaining || 0)} 枚骰子待掷` : "轮流投骰，争夺奖金"}</strong><span>${view.config.neutral_dice ? "彩色骰子与白骰一起掷出" : "每次掷出全部剩余骰子"}</span></div></div>`}
            <div class="lv-action-line"><span class="lv-choice-label">${selected !== null ? `已选 ${selected} 点 · 放置 ${rollCount(selected)} 枚` : hasRoll ? (allowed("place") ? "选择一个点数" : "等待玩家选择点数") : own ? "🎲 你的幸运回合" : "Spectating"}</span><button type="button" class="lv-primary" data-lv-action="${hasRoll ? "place" : "roll"}" data-lv-explain="${hasRoll ? "place" : "roll"}" ${hasRoll ? (!allowed("place") || selected === null ? "disabled" : "") : (!allowed("roll") ? "disabled" : "")}>${pending ? "Sending…" : hasRoll ? "Place Dice" : "Roll Dice"}</button></div>
        </section>`;
    }

    function renderReview() {
        if (view.phase !== "round_end" || !view.round_summary) return "";
        const own = view.round_summary.earnings.find(item => item.player_id === view.you);
        return `<section class="lv-box lv-review"><div class="lv-section-heading"><h3>Round ${view.round} · Payouts</h3>${info("💵 已结算", "payout")}</div><div class="lv-earnings">${view.round_summary.earnings.map(row => `<div class="lv-earning"><span class="lv-player-dot lv-color-${playerColor(row.player_id)}" aria-hidden="true"></span><span>${esc(playerName(row.player_id))}</span><strong>${money(row.amount)}</strong></div>`).join("")}</div>
            <div class="lv-review-note">${own ? `本轮收入 ${money(own.amount)}` : "赌场保留本轮最终分配"}${view.round_summary.neutral_returned ? ` · 白骰回收 ${money(view.round_summary.neutral_returned)}` : ""}</div>
            <div class="lv-action-line"><span>Ready <b>${view.next_ready.length} / ${view.players.length}</b></span><button type="button" class="lv-primary" data-lv-action="next" data-lv-explain="next" ${!allowed("next_round") ? "disabled" : ""}>${pending ? "Sending…" : view.next_ready.includes(view.you) ? "Waiting…" : "Next Round"}</button></div></section>`;
    }

    function renderFinal() {
        if (!view.game_over) return "";
        const winners = view.final_results.filter(item => item.rank === 1);
        return `<section class="lv-box lv-final"><span class="lv-eyebrow">THE NIGHT BELONGS TO</span><h3>${info("🏆", "total")} ${esc(winners.map(item => playerName(item.player_id)).join(" / "))}</h3><p>${winners.length > 1 ? "并列获胜" : "大赢家"} · 4 轮奖金全部结算</p><div class="lv-rankings">${view.final_results.map(row => `<div class="lv-rank-row ${row.rank === 1 ? "is-winner" : ""}"><b class="lv-rank">${row.rank}</b><span>${esc(playerName(row.player_id))}<small>${row.banknote_count} 张钞票</small></span><strong>${info(money(row.total), "total")}</strong></div>`).join("")}</div></section>`;
    }

    function renderPlayers() {
        return `<section class="lv-box"><div class="lv-section-heading"><h3>At the Table</h3>${info(`${view.players.length} players`, "player")}</div><div class="lv-players">${view.players.map(item => {
            const current = !view.game_over && ["roll", "place"].includes(view.phase) && item.player_id === view.current_turn;
            const status = view.game_over ? "Final" : view.phase === "round_end" ? view.next_ready.includes(item.player_id) ? "Ready" : "Reviewing" : current ? "Playing" : item.remaining + item.neutral_remaining === 0 ? "Done" : "Waiting";
            return `<article class="lv-player ${current ? "is-current" : ""}"><div class="lv-player-heading"><span class="lv-player-dot lv-color-${playerColor(item.player_id)}" aria-hidden="true"></span><strong>${esc(item.name)}${item.player_id === view.you ? " <small>You</small>" : ""}</strong>${item.is_bot ? info("🤖", "bot") : ""}<span class="lv-player-status">${status}</span></div><div class="lv-player-stats">${info(`${item.remaining}🎲`, "dice")}${view.config.neutral_dice ? info(`${item.neutral_remaining}⚪`, "neutral") : ""}${info(`💵 ${item.banknote_count} 张`, "money")}${item.total !== null ? info(money(item.total), item.player_id === view.you ? "private" : "total") : info("🔒", "private")}</div></article>`;
        }).join("")}</div></section>`;
    }

    function renderWallet() {
        if (!player(view.you)) return "";
        return `<section class="lv-box lv-wallet"><div class="lv-section-heading"><h3>Your Winnings</h3>${info("🔒 Private", "private")}</div><strong class="lv-wallet-total">${info(money(view.your_total), "private")}</strong><div class="lv-wallet-notes">${view.your_banknotes.length ? view.your_banknotes.slice().sort((a, b) => b - a).map(note => info(`<span class="lv-banknote">💵 ${shortMoney(note)}</span>`, "money")).join("") : '<span class="lv-muted">奖金将在这里积累</span>'}</div></section>`;
    }

    function statusText() {
        if (view.game_over) return "对局结束 · 查看最终排名";
        if (pending) return "Sending…";
        if (view.phase === "round_end") return view.next_ready.includes(view.you) ? "已确认 · 等待所有人查看结算" : "本轮结算完成 · 查看各赌场分配后点击 Next Round";
        if (view.current_turn !== view.you) return `等待 ${playerName(view.current_turn)} ${view.phase === "roll" ? "掷骰" : "选择点数"}`;
        return view.phase === "roll" ? "轮到你了 · 掷出所有剩余骰子" : "选择一个点数 · 查看奖金预览后确认放置";
    }

    function render() {
        if (!view) return;
        const scroll = content.querySelector(".lv-log")?.scrollTop || 0;
        content.innerHTML = `<div class="lv-surface"><div class="lv-banner"><div><span class="lv-eyebrow">SIX CASINOS. ONE LUCKY NIGHT.</span><h2>拉斯维加斯 <small>Las Vegas</small></h2></div><div class="lv-round-marker">${info(`<span>ROUND</span><b>${view.round}<small> / ${view.total_rounds}</small></b>`, "round")}</div></div>
            <div class="lv-status" role="status" aria-live="polite"><span>${esc(statusText())}</span>${info(view.config.neutral_dice ? "⚪ 白骰变体" : "🎲 基础模式", view.config.neutral_dice ? "neutral" : "dice")}</div>
            <div class="lv-layout"><div class="lv-main">${renderFinal()}${renderReview()}${renderControls()}<section class="lv-board"><div class="lv-section-heading"><h3>The Strip <small>六大赌场</small></h3>${info(view.phase === "round_end" || view.game_over ? "Final payouts" : "💵 Payout preview", "payout")}</div><div class="lv-casinos">${view.casinos.map(renderCasino).join("")}</div></section></div><aside class="lv-sidebar">${renderPlayers()}${renderWallet()}<section class="lv-box lv-log-box"><div class="lv-section-heading"><h3>Activity</h3>${info("Public log", "log")}</div><div class="lv-log">${view.log.slice().reverse().map(entry => `<p>${typeof entry === "string" ? esc(entry) : `${entry.round ? `<small>${info(`R${entry.round}`, "round", `R 表示 Round：这条记录发生在第 ${entry.round} 轮。整场共 4 轮。`)}</small>` : ""}<span>${esc(entry.text || entry.message || "")}</span>`}</p>`).join("") || '<p class="lv-muted">No activity yet.</p>'}</div></section></aside></div></div>`;
        content.querySelector(".lv-log").scrollTop = scroll;
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

    function selectFace(face) {
        if (!allowed("place") || !rollCount(face)) return;
        selected = selected === face ? null : face;
        hideTip();
        render();
        content.querySelector(`.lv-roll-group[data-lv-face="${face}"]`)?.focus({preventScroll: true});
    }

    panel.addEventListener("click", event => {
        if (explaining || dialog.contains(event.target)) return;
        const button = event.target.closest("button");
        if (button && !button.disabled && view) {
            if (button.dataset.lvFace) selectFace(Number(button.dataset.lvFace));
            const action = button.dataset.lvAction;
            if (action === "roll" && allowed("roll")) submit({type: "roll", round: view.round, turn: view.turn});
            if (action === "place" && selected !== null && allowed("place")) submit({type: "place", round: view.round, turn: view.turn, face: selected});
            if (action === "next" && allowed("next_round")) submit({type: "next_round", round: view.round});
            return;
        }
        const anchor = event.target.closest("[data-lv-tip]");
        if (anchor) showTip(anchor, true);
    });

    function explainAt(event) {
        const control = event.target.closest("button, input, select, a");
        let element = control ? (control.matches("[data-lv-explain]") ? control : null) : event.target.closest("[data-lv-explain]");
        if (event.type === "pointerdown") {
            const disabled = [...panel.querySelectorAll(":disabled[data-lv-explain]")].find(item => {
                const rect = item.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
            });
            if (disabled) element = disabled;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (element && explanations[element.dataset.lvExplain]) {
            const detail = explanations[element.dataset.lvExplain];
            setExplain(false);
            if (event.type === "pointerdown") suppressUntil = performance.now() + 700;
            openDialog("Explain", `<p>${esc(detail)}</p>`);
        }
    }

    document.addEventListener("pointerdown", event => {
        if (!explaining || event.target.closest("#lasVegasHelpBtn, #lasVegasExplainBtn, #lasVegasDialog")) return;
        explainAt(event);
    }, true);
    document.addEventListener("click", event => {
        if (performance.now() < suppressUntil) {
            suppressUntil = 0; event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (!explaining || event.target.closest("#lasVegasHelpBtn, #lasVegasExplainBtn, #lasVegasDialog")) return;
        explainAt(event);
    }, true);
    document.addEventListener("click", event => {
        if (!view || selected === null || pending || explaining || dialog.open || !panel.getClientRects().length) return;
        if (event.target.closest("button, input, select, a, label, [data-lv-tip], #lasVegasDialog")) return;
        selected = null; hideTip(); render();
    });
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-lv-tip]")); });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-lv-tip]")));
    panel.addEventListener("focusout", hideTip);
    panel.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-lv-tip]")) {
            event.preventDefault();
            if (explaining) explainAt(event);
            else showTip(event.target, true);
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !panel.getClientRects().length) return;
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
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true}); });
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    document.addEventListener("scroll", hideTip, true);

    function syncRoom(state) {
        if (!state || state.game_type !== "las_vegas") return;
        const lobby = state.status === "lobby";
        setup.hidden = !lobby;
        if (lobby) {
            view = null; selected = null; signature = null; content.innerHTML = "";
            pending = false; clearTimeout(pendingTimer);
        }
        const nextConfigSignature = JSON.stringify([state.room_id, !!state.game_config?.neutral_dice]);
        if (configSignature !== nextConfigSignature) neutralCheckbox.checked = !!state.game_config?.neutral_dice;
        configSignature = nextConfigSignature;
        neutralCheckbox.disabled = (state.players?.length || 0) > 4;
        if (neutralCheckbox.disabled) neutralCheckbox.checked = false;
        neutralCheckbox.dataset.lvExplain = "neutral";
        document.getElementById("lasVegasSetupHint").textContent = neutralCheckbox.disabled ? "5 人使用基础模式 · 白骰变体限 2–4 人" : "每人 8 枚骰子 · 4 轮争夺赌场奖金";
    }

    window.renderLasVegasGameState = data => {
        const next = data?.view;
        if (!next || next.game_id !== "las_vegas") return;
        const nextSignature = JSON.stringify([data.room_id, next.you, next.round, next.turn, next.phase]);
        if (signature !== nextSignature) { selected = null; hideTip(); }
        signature = nextSignature;
        view = next;
        neutralCheckbox.checked = !!next.config.neutral_dice;
        if (selected !== null && !rollCount(selected)) selected = null;
        pending = false;
        clearTimeout(pendingTimer);
        setup.hidden = true;
        render();
    };
    window.showLasVegasHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) {
            view = null; selected = null; signature = null; configSignature = null; pending = false; suppressUntil = 0;
            clearTimeout(pendingTimer);
            setExplain(false); hideTip();
            if (dialog.open) dialog.close();
            content.innerHTML = "";
            setup.hidden = true;
        }
    };

    function connectEvents() {
        if (typeof socket === "undefined") return;
        socket.on("system:error", () => {
            if (pending) { pending = false; clearTimeout(pendingTimer); render(); }
        });
        socket.on("room:state", syncRoom);
        if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "las_vegas" && typeof currentRoomState !== "undefined" && currentRoomState?.status !== "lobby" && currentRoomState?.room_id === lastGameStatePayload.room_id) window.renderLasVegasGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    else connectEvents();
})();
