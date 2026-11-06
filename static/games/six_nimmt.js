(() => {
    "use strict";

    const byId = suffix => document.getElementById(`sixNimmt${suffix}`);
    const panel = byId("Panel");
    const header = byId("HeaderActions");
    const guide = byId("Guide");
    const summaryDialog = byId("SummaryModal");
    const tooltip = byId("Tooltip");
    if (!panel || !header || !guide || !summaryDialog) return;

    const explanations = {
        card: "数字牌（🃏）共 1–104，每个数字只有一张。大数字决定放牌顺序，底部牛头（🐮）数量是吃到这张牌的罚分；两者不是同一件事。",
        row: "每张牌进入末尾数字比它小、且最接近它的那一行。行头显示本行牛头（🐮）总罚分和占用格数。已有五张时，再放入第六张（6!）就吃掉前五张。",
        danger: "第六张（6!）是危险位置，不是空位。放到这里的玩家拿走前五张的全部牛头（🐮）罚分，自己的牌留下成为新行首。",
        score: "牛头（🐮）是罚分，越少越好。有人达到 66 分后仍需打完本轮全部 10 张牌，所有玩家确认结算后整局结束；最低总罚分获胜，同分并列。",
        hand: "点选手牌仅作预览，不会提交。再次点击、点击空白处或按 Esc 可取消；点击 Play Card 才锁定。绿色描边只表示当前牌桌上的可能落点，其他人的暗牌可能改变它。",
        play: "Play Card 锁定所选数字牌（🃏），提交后不能撤回。所有人锁定后才一起揭牌，从小到大依次放入牌桌。",
        take: "牌小于所有行末时，必须选择一整行吃掉。点行后用 Take Row 确认；行头的牛头（🐮）总数就是新增罚分，自己的牌成为这一行的新起点。",
        next: "Next Round 表示已经看过本次揭牌结果，不会再次弹出确认。所有玩家都确认后才继续；机器人只确认自己。View Table、Esc 或点击遮罩只是收起结果，不表示确认。",
        summary: "揭牌结果按数字从小到大排列，显示每人出的牌、落点及吃牌罚分；你的条目用绿色标出。收起后可以在 Results 中重新打开。",
        reveal: "揭牌顺序只含已公开的牌；选牌期间显示上一次揭牌，不包含任何人尚未公开的选择。可折叠、滚动查看。",
        timer: "倒计时（⏱）由房间设置决定。选牌超时会为未出牌者随机出牌；选行超时会吃掉牛头（🐮）最少的一行。回合结算没有倒计时，必须主动确认。",
        player: "计分栏显示总罚分（🐮）、本轮剩余手牌（🃏）和锁定／确认状态（✓）。其他玩家的手牌与本次暗选牌不会公开。机器人（🤖）使用公开信息评估吃牌风险。",
    };
    let view = null;
    let scope = null;
    let selection = null;
    let selectedRow = null;
    let pending = null;
    let pendingTimer = null;
    let countdown = null;
    let tipTimer = null;
    let explaining = false;
    let summaryKey = null;
    let summaryDocked = false;
    let renderKey = null;
    let pointer = null;
    let suppressClickUntil = 0;
    let focusBeforeGuide = null;

    const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
    const allowed = action => !!view?.legal_actions?.includes(action);
    const ownPlayer = () => view?.players?.find(player => player.player_id === view.you);
    const playerName = player => `${player.name || "Player"}${player.player_id === view?.you ? " · You" : ""}`;
    const info = (html, key, detail = "") => `<span tabindex="0" data-sn-explain="${key}" data-sn-tip="${esc(detail || explanations[key])}">${html}</span>`;
    const cardText = card => `${card.value} · ${card.bulls}🐮`;

    function cardMarkup(card, attributes = "", button = false) {
        const tag = button ? "button" : "div";
        return `<${tag} ${button ? 'type="button"' : ""} class="sn-card" data-bulls="${card.bulls}" data-sn-explain="${button ? "hand" : "card"}" ${button ? "" : `tabindex="0" data-sn-tip="${esc(`${cardText(card)}：数字决定顺序，牛头是罚分。`) }"`} aria-label="${esc(`数字 ${card.value}，${card.bulls} 个牛头`)}" ${attributes}><span class="sn-card-value">${card.value}</span><span class="sn-card-bulls" aria-hidden="true">🐮 ×${card.bulls}</span></${tag}>`;
    }

    function hideTip() {
        clearTimeout(tipTimer);
        tooltip.hidden = true;
    }

    function showTip(anchor, touch = false) {
        hideTip();
        if (!anchor || explaining || anchor.closest("button, [role='button']")) return;
        if (guide.open && !guide.contains(anchor)) return;
        if (summaryDialog.open && !guide.open && !summaryDialog.contains(anchor)) return;
        tooltip.textContent = anchor.dataset.snTip;
        if (!tooltip.textContent) return;
        const host = anchor.closest("dialog") || panel;
        if (tooltip.parentNode !== host) host.appendChild(tooltip);
        tooltip.hidden = false;
        const bounds = anchor.getBoundingClientRect();
        const tipBounds = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(10, Math.min(innerWidth - tipBounds.width - 10, bounds.left + bounds.width / 2 - tipBounds.width / 2))}px`;
        tooltip.style.top = `${Math.max(10, bounds.top >= tipBounds.height + 18 ? bounds.top - tipBounds.height - 8 : Math.min(innerHeight - tipBounds.height - 10, bounds.bottom + 8))}px`;
        if (touch) tipTimer = setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        hideTip();
        panel.classList.toggle("sn-explaining", enabled);
        byId("ExplainBtn").setAttribute("aria-pressed", String(enabled));
    }

    function openGuide(title, html) {
        setExplain(false);
        if (summaryDialog.open) dockSummary();
        focusBeforeGuide = document.activeElement;
        byId("GuideTitle").textContent = title;
        byId("GuideBody").innerHTML = html;
        if (!guide.open) guide.showModal();
    }

    function openHelp() {
        openGuide("Help · 6 nimmt!", `<h3>目标 · 少吃牛头（🐮）</h3><p>2–10 人，每人每轮 10 张数字牌（🃏）。共 104 张牌，数字不重复；四行各从一张牌开始。</p><ol><li>各自暗选一张牌，用 <b>Play Card</b> 锁定。</li><li>全部锁定后一起揭牌，从小到大放到“比它小且最接近”的行末。</li><li>成为<b>第六张（6!）</b>时，吃掉前五张并计入它们的牛头罚分；自己的牌留下。</li><li>比所有行末都小时，自选一整行吃掉，再用自己的牌重新开行。</li><li>查看结果后点击 <b>Next Round</b>；所有人确认后继续。每轮出完 10 张再重新发牌。</li></ol><h3>牌面 · 数字与罚分分开看</h3><div class="sn-guide-legend">${[{value: 1, bulls: 1}, {value: 5, bulls: 2}, {value: 10, bulls: 3}, {value: 11, bulls: 5}, {value: 55, bulls: 7}].map(card => cardMarkup(card)).join("")}</div><p>55 = 7🐮；其他 11 的倍数 = 5🐮；10 的倍数 = 3🐮；其他 5 的倍数 = 2🐮；其余 = 1🐮。颜色辅助识别，准确罚分始终显示在牌底。</p><h3>终局与操作</h3><p>${explanations.score}</p><p>${explanations.hand}</p><p>${explanations.next}</p><p>${explanations.timer}</p><h3>AI · 公开信息策略</h3><p>通过 Room Controls 的 Add Bot 添加机器人。AI 只看自己的手牌、公开牌桌和已揭牌历史，对未知对手手牌抽样，评估第六张风险、预计罚分和剩余手牌；选行优先少吃罚分。不会读取其他人的暗牌。</p><p>✓ 表示已锁定或已确认；🤖 表示机器人；⏱ 表示剩余时间。Explain 点选可查看说明；Esc 关闭对话框或取消尚未提交的选择。</p>`);
    }

    function previewRow() {
        if (selection === null || !view) return null;
        const candidates = view.rows.filter(row => row.cards.at(-1)?.value < selection);
        return candidates.length ? candidates.reduce((best, row) => row.cards.at(-1).value > best.cards.at(-1).value ? row : best).id : null;
    }

    function renderRows() {
        const canChoose = allowed("choose_row") && !pending;
        const preview = previewRow();
        byId("Rows").innerHTML = view.rows.map(row => {
            const chosen = selectedRow === row.id;
            const cards = row.cards.map(card => cardMarkup(card)).join("");
            const slots = Array.from({length: Math.max(0, 5 - row.cards.length)}, (_, index) => `<div class="sn-card sn-slot" aria-hidden="true">${row.cards.length + index + 1}</div>`).join("");
            return `<div class="sn-row ${row.cards.length === 5 ? "is-full" : ""} ${preview === row.id ? "is-preview" : ""} ${chosen ? "is-selected" : ""} ${canChoose ? "is-selectable" : ""}" data-sn-row="${row.id}" data-sn-explain="${canChoose ? "take" : "row"}" ${canChoose ? `role="button" tabindex="0" aria-pressed="${chosen}" aria-label="选择第 ${row.id + 1} 行，${row.bulls_total} 个牛头"` : ""}><div class="sn-row-label">${info(`ROW ${row.id + 1}`, "row")}<strong>${info(`🐮${row.bulls_total}`, "row", `第 ${row.id + 1} 行：吃牌增加 ${row.bulls_total} 个牛头罚分。`)}</strong><small>${row.cards.length} / 5</small></div><div class="sn-row-cards">${cards}${slots}<div class="sn-card sn-danger" tabindex="0" data-sn-explain="danger" data-sn-tip="${explanations.danger}">6!</div></div></div>${chosen && allowed("choose_row") ? `<div class="sn-row-confirm"><span>+${row.bulls_total}🐮 · 第 ${row.id + 1} 行</span><button type="button" data-sn-cancel-row ${pending ? "disabled" : ""}>Cancel</button><button type="button" class="sn-primary" data-sn-take="${row.id}" data-sn-explain="take" ${pending ? "disabled" : ""}>${pending ? "Sending…" : "Take Row"}</button></div>` : ""}`;
        }).join("");
    }

    function renderHand() {
        const hand = view.hand || [];
        byId("HandCount").innerHTML = ownPlayer() ? info(`${hand.length} 🃏${view.selected_card ? " · 1 locked" : ""}`, "hand") : "Spectating";
        byId("Hand").innerHTML = hand.length ? hand.map(card => cardMarkup(card, `data-sn-card="${card.value}" aria-pressed="${selection === card.value}" ${!allowed("select_card") || pending ? "disabled" : ""}`, true)).join("") : `<p class="sn-empty">${ownPlayer() ? "本轮手牌已出完" : "Spectating · 手牌保持隐藏"}</p>`;
        for (const card of byId("Hand").querySelectorAll("[data-sn-card]")) card.classList.toggle("is-selected", Number(card.dataset.snCard) === selection);
        const preview = view.rows.find(row => row.id === previewRow());
        const hint = byId("SelectionHint");
        if (view.selected_card) hint.textContent = `🔒 已锁定 ${cardText(view.selected_card)}`;
        else if (selection !== null) hint.textContent = `${selection} → ${preview ? `第 ${preview.id + 1} 行${preview.cards.length === 5 ? ` · 当前 +${preview.bulls_total}🐮` : ""}` : "须自选一行"}（仅当前预览）`;
        else hint.textContent = allowed("select_card") ? "点选手牌，确认后锁定" : ownPlayer() ? "等待下一次选牌" : "Spectating";
        byId("PlayBtn").disabled = !allowed("select_card") || selection === null || !!pending;
        byId("PlayBtn").textContent = pending?.type === "select_card" ? "Sending…" : "Play Card";
    }

    function renderPlayers() {
        byId("Players").innerHTML = view.players.map(player => {
            const acked = view.summary_ack?.includes(player.player_id);
            const status = view.phase === "turn_summary" ? (acked ? "✓ Ready" : "Reviewing") : view.phase === "selection" ? (player.selected ? "✓ Locked" : "Choosing") : "";
            const taken = view.last_turn_summary?.placements?.find(entry => entry.player_id === player.player_id && entry.took_row);
            return `<div class="sn-player ${player.player_id === view.you ? "is-you" : ""}" data-sn-explain="player"><div class="sn-player-top"><span class="sn-player-name" tabindex="0" data-sn-tip="${esc(playerName(player))}">${esc(playerName(player))}</span><span class="sn-player-score">${info(`${player.score}🐮`, "score")}</span></div><div class="sn-player-meta">${info(`${player.is_bot ? "🤖 · " : ""}${player.hand_count}🃏`, "player")}${info(status, "player")}${taken ? `<span class="sn-player-gain">${info(`+${taken.penalty}🐮`, "score", `上次揭牌吃到 ${taken.penalty} 个牛头，已计入总罚分。`)}</span>` : ""}</div></div>`;
        }).join("");
    }

    function renderReveal() {
        const entries = view.reveal_order || [];
        byId("History").hidden = !entries.length;
        byId("PendingReveal").hidden = view.phase !== "row_choice" || !entries.length;
        byId("PendingReveal").innerHTML = `<small>已揭牌 · 从小到大</small>${entries.map(entry => `<span class="sn-reveal-chip ${entry.player_id === view.waiting_for?.player_id ? "is-waiting" : ""}">${info(`<b>${entry.card.value}</b> ${esc(entry.player_id === view.you ? "You" : entry.name || "Player")}`, "reveal", `${playerName(entry)}：${cardText(entry.card)}${entry.player_id === view.waiting_for?.player_id ? "，正在选行" : ""}`)}</span>`).join("")}`;
        byId("RevealMeta").textContent = view.phase === "selection" ? "· Previous" : "· Current";
        byId("Reveal").innerHTML = entries.map((entry, index) => `<div class="sn-reveal-entry ${entry.player_id === view.you ? "is-you" : ""}"><span>${index + 1}. ${esc(playerName(entry))}</span><b>${cardText(entry.card)}</b></div>`).join("");
    }

    function updateTimer(next) {
        clearInterval(countdown);
        countdown = null;
        const timer = byId("Timer");
        const deadline = next?.pending_timeout?.at_ms;
        timer.hidden = !deadline || next.game_over;
        if (timer.hidden) return;
        timer.dataset.snTip = explanations.timer;
        const offset = (next.server_time_ms || Date.now()) - Date.now();
        const tick = () => {
            const seconds = Math.max(0, Math.ceil((deadline - Date.now() - offset) / 1000));
            timer.textContent = `⏱ ${seconds}s`;
            timer.classList.toggle("is-urgent", seconds <= 5);
            if (!seconds) { clearInterval(countdown); countdown = null; }
        };
        tick();
        if (deadline > Date.now() + offset) countdown = setInterval(tick, 250);
    }

    function renderStatus() {
        byId("Round").textContent = `ROUND ${String(view.round).padStart(2, "0")}`;
        byId("Turn").textContent = `TURN ${view.turn} / 10`;
        const notice = byId("NoticeBody");
        if (view.game_over) notice.textContent = "整局结束 · 罚分最低者获胜";
        else if (allowed("choose_row")) notice.textContent = `${view.waiting_for.card.value} 比所有行末小 · 请选择一行吃牌`;
        else if (view.phase === "row_choice") notice.textContent = `等待 ${view.waiting_for?.name || "玩家"} 为 ${view.waiting_for?.card.value ?? "—"} 选行`;
        else if (view.phase === "turn_summary") notice.textContent = "本次揭牌已结算 · 等所有人确认后继续";
        else if (allowed("select_card")) notice.textContent = "选一张牌 · 小心第六张！";
        else notice.textContent = view.selected_card ? "已锁定，等待其他玩家选牌" : "Spectating · 等待揭牌";
        const ready = view.phase === "selection" ? view.players.filter(player => player.selected).length : view.phase === "turn_summary" ? (view.summary_ack || []).length : null;
        byId("Ready").textContent = ready === null ? "" : `${ready} / ${view.players.length} ${view.phase === "selection" ? "locked" : "ready"}`;
        document.body.classList.toggle("sn-action-needed", !pending && !view.game_over && view.legal_actions.length > 0);
        byId("Result").hidden = !view.game_over;
        if (view.game_over) byId("Result").innerHTML = `<strong>🏆 ${esc((view.winner_names || []).join(" · ") || "Game over")}</strong><span>最低总罚分 ${Math.min(...view.players.map(player => player.score))}🐮</span>`;
    }

    function dockSummary() {
        summaryDocked = true;
        if (summaryDialog.open) summaryDialog.close();
        byId("ShowSummaryBtn").focus({preventScroll: true});
    }

    function showSummary() {
        if (view?.phase !== "turn_summary") return;
        hideTip();
        setExplain(false);
        summaryDocked = false;
        if (!summaryDialog.open) summaryDialog.showModal();
    }

    function renderSummary() {
        const active = view.phase === "turn_summary";
        byId("SummaryDock").hidden = !active;
        if (!active) {
            summaryKey = null;
            summaryDocked = false;
            if (summaryDialog.open) summaryDialog.close();
            return;
        }
        const nextKey = `${scope}:${view.round}:${view.turn}`;
        if (nextKey !== summaryKey) {
            summaryKey = nextKey;
            summaryDocked = false;
        }
        const summary = view.last_turn_summary || {};
        byId("SummaryMeta").textContent = `ROUND ${summary.round ?? view.round} · TURN ${summary.turn ?? view.turn}`;
        byId("SummaryList").innerHTML = (summary.placements || []).map(entry => `<div class="sn-summary-item ${entry.player_id === view.you ? "is-you" : ""}">${cardMarkup(entry.card)}<div class="sn-summary-player"><strong>${esc(playerName(entry))}</strong><small>→ 第 ${entry.row_index + 1} 行${entry.took_row ? `<br>吃牌 ${entry.taken_cards.map(card => card.value).join(" · ")}` : " · 安全放置"}</small></div><span class="sn-summary-penalty ${entry.took_row ? "" : "is-safe"}">${entry.took_row ? `+${entry.penalty}🐮` : "+0"}</span></div>`).join("");
        const count = (view.summary_ack || []).length;
        const status = `Ready ${count} / ${view.players.length}${ownPlayer() ? " · 等待全员确认" : " · Spectating"}`;
        byId("SummaryStatus").textContent = status;
        byId("DockStatus").textContent = status;
        for (const suffix of ["SummaryNextBtn", "DockNextBtn"]) {
            const button = byId(suffix);
            button.disabled = !allowed("ack_turn_summary") || !!pending;
            button.textContent = pending?.type === "ack_turn_summary" ? "Sending…" : view.summary_ack?.includes(view.you) ? "Waiting…" : "Next Round";
        }
        if (!summaryDocked && !guide.open) showSummary();
    }

    function render() {
        if (!view) return;
        const active = document.activeElement;
        const focusKey = active?.dataset.snCard ? `[data-sn-card="${active.dataset.snCard}"]` : active?.dataset.snRow ? `[data-sn-row="${active.dataset.snRow}"]` : null;
        byId("Table").hidden = false;
        renderStatus();
        renderRows();
        renderHand();
        renderPlayers();
        renderReveal();
        renderSummary();
        if (focusKey) panel.querySelector(focusKey)?.focus({preventScroll: true});
    }

    function releasePending() {
        pending = null;
        clearTimeout(pendingTimer);
    }

    function submit(action) {
        if (pending || !allowed(action.type) || explaining) return;
        if (typeof ensureRoomConnection === "function" && !ensureRoomConnection()) return;
        hideTip();
        pending = action;
        render();
        pendingTimer = setTimeout(() => {
            releasePending();
            render();
            byId("NoticeBody").textContent = "No response yet · Retry or Reconnect";
        }, 8000);
        sendAction(action);
    }

    window.renderSixNimmtGameState = data => {
        const next = data?.view;
        if (!next || next.game_id !== "six_nimmt") return;
        const nextScope = JSON.stringify([data.room_id, next.you]);
        const phaseChanged = scope !== nextScope || view?.round !== next.round || view?.turn !== next.turn || view?.phase !== next.phase;
        if (phaseChanged) {
            selection = null;
            selectedRow = null;
            releasePending();
            hideTip();
        }
        if (pending && ((pending.type === "select_card" && !next.legal_actions.includes("select_card")) || (pending.type === "choose_row" && !next.legal_actions.includes("choose_row")) || (pending.type === "ack_turn_summary" && next.summary_ack.includes(next.you)))) releasePending();
        if (!next.hand.some(card => card.value === selection) || !next.legal_actions.includes("select_card")) selection = null;
        if (!next.legal_actions.includes("choose_row")) selectedRow = null;
        scope = nextScope;
        view = next;
        updateTimer(next);
        const nextRenderKey = JSON.stringify({...next, server_time_ms: 0});
        if (renderKey !== nextRenderKey || phaseChanged) {
            renderKey = nextRenderKey;
            hideTip();
            render();
        }
        if (typeof logGameEvents === "function") logGameEvents(data);
    };

    function reset() {
        view = null;
        scope = null;
        renderKey = null;
        selection = null;
        selectedRow = null;
        summaryKey = null;
        summaryDocked = false;
        pointer = null;
        suppressClickUntil = 0;
        releasePending();
        clearInterval(countdown);
        countdown = null;
        setExplain(false);
        hideTip();
        if (summaryDialog.open) summaryDialog.close();
        if (guide.open) guide.close();
        for (const suffix of ["Rows", "Hand", "Players", "Reveal", "SummaryList"]) byId(suffix).replaceChildren();
        for (const suffix of ["Table", "SummaryDock", "Result", "Timer"]) byId(suffix).hidden = true;
        byId("Round").textContent = "ROUND —";
        byId("Turn").textContent = "TURN — / 10";
        byId("Ready").textContent = "";
        byId("NoticeBody").textContent = "Waiting to start · 2–10 players";
        document.body.classList.remove("sn-action-needed");
    }

    window.clearSixNimmtState = reset;
    window.showSixNimmtHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) reset();
    };

    function bindEvents() {
        byId("HelpBtn").addEventListener("click", openHelp);
        byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
        byId("GuideClose").addEventListener("click", () => guide.close());
        guide.addEventListener("close", () => { if (focusBeforeGuide?.isConnected) focusBeforeGuide.focus({preventScroll: true}); });
        byId("SummaryHideBtn").addEventListener("click", dockSummary);
        byId("ShowSummaryBtn").addEventListener("click", showSummary);
        byId("PlayBtn").addEventListener("click", () => { if (selection !== null) submit({type: "select_card", value: selection}); });
        for (const suffix of ["SummaryNextBtn", "DockNextBtn"]) byId(suffix).addEventListener("click", () => submit({type: "ack_turn_summary"}));
        summaryDialog.addEventListener("cancel", event => { event.preventDefault(); dockSummary(); });
        for (const dialog of [guide, summaryDialog]) dialog.addEventListener("click", event => {
            if (event.target !== dialog) return;
            const bounds = dialog.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
                if (dialog === summaryDialog) dockSummary();
                else guide.close();
            }
        });

        panel.addEventListener("click", event => {
            if (explaining) return;
            if (event.target.closest("dialog")) {
                showTip(event.target.closest("[data-sn-tip]"), true);
                return;
            }
            if (!view || pending) return;
            const card = event.target.closest("[data-sn-card]");
            const row = event.target.closest("[data-sn-row]");
            const take = event.target.closest("[data-sn-take]");
            if (card && allowed("select_card") && !card.disabled) {
                const value = Number(card.dataset.snCard);
                selection = selection === value ? null : value;
                hideTip();
                renderRows();
                renderHand();
                byId("Hand").querySelector(`[data-sn-card="${value}"]`)?.focus({preventScroll: true});
            } else if (take) {
                submit({type: "choose_row", row_index: Number(take.dataset.snTake)});
            } else if (event.target.closest("[data-sn-cancel-row]")) {
                selectedRow = null;
                renderRows();
            } else if (row && allowed("choose_row")) {
                const rowIndex = Number(row.dataset.snRow);
                selectedRow = selectedRow === rowIndex ? null : rowIndex;
                hideTip();
                renderRows();
                byId("Rows").querySelector(`[data-sn-row="${rowIndex}"]`)?.focus({preventScroll: true});
            } else {
                showTip(event.target.closest("[data-sn-tip]"), true);
            }
        });
        panel.addEventListener("keydown", event => {
            if (explaining || !["Enter", " "].includes(event.key)) return;
            const row = event.target.closest("[data-sn-row][role='button']");
            if (row && !event.target.closest("button")) {
                event.preventDefault();
                row.click();
            } else if (event.target.matches("[data-sn-tip]") && !event.target.closest("button")) {
                event.preventDefault();
                showTip(event.target, true);
            }
        });
        panel.addEventListener("pointerover", event => {
            if (event.pointerType === "mouse") showTip(event.target.closest("[data-sn-tip]"));
        });
        panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
        panel.addEventListener("focusin", event => showTip(event.target.closest("[data-sn-tip]")));
        panel.addEventListener("focusout", hideTip);

        document.addEventListener("pointerdown", event => {
            if (!panel.getClientRects().length || !event.isPrimary) return;
            suppressClickUntil = 0;
            pointer = {id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, target: event.target};
        }, true);
        document.addEventListener("pointermove", event => {
            if (!pointer || pointer.id !== event.pointerId) return;
            if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 9) pointer.moved = true;
        }, true);
        document.addEventListener("pointercancel", () => {
            if (pointer) suppressClickUntil = performance.now() + 700;
            pointer = null;
        }, true);
        document.addEventListener("pointerup", event => {
            if (!pointer || pointer.id !== event.pointerId) return;
            if (pointer.moved) {
                suppressClickUntil = performance.now() + 700;
                pointer = null;
                return;
            }
            if (explaining && !event.target.closest("#sixNimmtHelpBtn, #sixNimmtExplainBtn, #sixNimmtGuide, #sixNimmtSummaryHideBtn")) {
                let anchor = event.target.closest("[data-sn-explain]");
                const disabled = Array.from(panel.querySelectorAll("button:disabled[data-sn-explain]")).find(button => {
                    const bounds = button.getBoundingClientRect();
                    return bounds.width > 0 && bounds.height > 0 && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
                });
                if (disabled) anchor = disabled;
                event.preventDefault();
                event.stopImmediatePropagation();
                suppressClickUntil = performance.now() + 700;
                if (anchor && explanations[anchor.dataset.snExplain]) openGuide("Explain", `<p>${esc(explanations[anchor.dataset.snExplain])}</p>`);
            }
            pointer = null;
        }, true);
        document.addEventListener("click", event => {
            if (!panel.getClientRects().length) return;
            if (performance.now() < suppressClickUntil && event.detail !== 0) {
                event.preventDefault();
                event.stopImmediatePropagation();
                suppressClickUntil = 0;
                return;
            }
            if (!explaining || event.target.closest("#sixNimmtHelpBtn, #sixNimmtExplainBtn, #sixNimmtGuide, #sixNimmtSummaryHideBtn")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const anchor = event.target.closest("[data-sn-explain]");
            if (anchor && explanations[anchor.dataset.snExplain]) openGuide("Explain", `<p>${esc(explanations[anchor.dataset.snExplain])}</p>`);
        }, true);
        document.addEventListener("click", event => {
            if (!view || pending || explaining || guide.open || summaryDialog.open || !panel.getClientRects().length) return;
            if (event.target.closest("button, input, select, a, label, summary, [role='button'], [data-sn-tip], dialog")) return;
            if (selection === null && selectedRow === null) return;
            selection = null;
            selectedRow = null;
            hideTip();
            renderRows();
            renderHand();
        });
        document.addEventListener("keydown", event => {
            if (event.key !== "Escape" || !panel.getClientRects().length) return;
            setExplain(false);
            hideTip();
            if (guide.open || summaryDialog.open || pending) return;
            if (selection !== null || selectedRow !== null) {
                selection = null;
                selectedRow = null;
                renderRows();
                renderHand();
            }
        });
        document.addEventListener("scroll", () => {
            hideTip();
            if (pointer) pointer.moved = true;
        }, true);
        window.addEventListener("resize", hideTip);
        window.addEventListener("blur", () => { hideTip(); pointer = null; });
    }

    bindEvents();

    function syncRoom(state) {
        if (!state || state.game_type !== "six_nimmt") return;
        if (state.status === "lobby" || (scope && JSON.parse(scope)[0] !== state.room_id)) reset();
    }

    function connectEvents() {
        if (typeof socket === "undefined") return;
        socket.on("system:error", () => {
            if (!pending) return;
            releasePending();
            render();
        });
        socket.on("room:state", syncRoom);
        socket.on("disconnect", () => {
            if (!view) return;
            releasePending();
            render();
            byId("NoticeBody").textContent = "Disconnected · Reconnect to continue";
        });
        if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "six_nimmt" && typeof currentRoomState !== "undefined" && currentRoomState?.status !== "lobby" && currentRoomState?.room_id === lastGameStatePayload.room_id) window.renderSixNimmtGameState(lastGameStatePayload);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    else connectEvents();
})();
