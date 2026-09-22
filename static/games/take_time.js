(() => {
    "use strict";

    const panel = document.getElementById("takeTimePanel");
    const header = document.getElementById("takeTimeHeaderActions");
    const help = document.getElementById("takeTimeHelpBtn");
    const explainButton = document.getElementById("takeTimeExplainBtn");
    const dialog = document.getElementById("takeTimeDialog");
    const dialogTitle = document.getElementById("takeTimeDialogTitle");
    const dialogBody = document.getElementById("takeTimeDialogBody");
    const dialogClose = document.getElementById("takeTimeDialogClose");
    const configBox = document.getElementById("takeTimeConfigBox");
    let view = null;
    let version = null;
    let selectedCard = null;
    let selectedSegment = null;
    let explaining = false;
    let pending = false;
    let pendingTimer = null;
    let suppressClick = false;
    let suppressTimer = null;
    let returnFocus = null;
    let planOpen = false;
    let logOpen = false;
    let tipAnchor = null;
    let tipTimer = null;
    let tipHideTimer = null;
    let touchStart = null;
    let inputKind = "mouse";
    const tip = document.createElement("div");
    tip.id = "takeTimeImmediateTip";
    tip.className = "take-time-tooltip";
    tip.hidden = true;
    document.body.append(tip);

    const explanations = {
        card: ["Your cards", "太阳 Solar(☀️) 和月亮 Lunar(🌙) 各有 1–12；未知数值(?) 在 Ready 前隐藏。点击选择一张自己的牌，再选择时段。暗置后仍可查看自己的牌；仅自己可见(🔒)，公开可见(👁)。灰色牌暂时不可出，可能尚未轮到你，或本关要求先出最大／最小牌。"],
        sector: ["Clock segment", "从指针起点(🧭 / START) 开始，按顺时针序号(↻) 比较六个时段。每段至少一张，总和(Σ)可以相等；差值(Δ)关比较两张牌的大数减小数。颜色、数量、目标等条件在揭牌时判定。通过(✓)、未通过(✕)只在结算后显示。"],
        ready: ["Ready", "先讨论(💬)并商量目标。Ready 会让你看见自己的手牌并保持静默(🤫)，不能撤销；全员准备后才允许出牌。第一个人 Ready 后公共目标(🎯)锁定。"],
        down: ["Place face down", "暗置(🔒)：将选中的手牌放到选中的时段，立即结束你的回合。队友能看到牌背颜色、是谁出的和出牌顺序(#)，不能看到数值。已放的牌不能移动。"],
        up: ["Place face up", "明置(👁)：花一个全队共享的明牌额度，将选中的牌公开放置。基础额度等于人数，重试最多获得额外 3 次。禁止明牌(🙈)的静夜练习即使有奖励也不能明置。"],
        plan: ["Shared target", "公共目标(🎯)：讨论时用增加(+)／减少(−)约定各段的大致目标。目标只是参考，不参与胜负。首位玩家 Ready 后锁定。自由指针关卡的目标按起点顺序显示。"],
        hand: ["Clock hand", "指针起点(🧭 / START) 决定顺时针序号(↻)。普通钟盘从时段 1 开始。自由指针练习可在看牌前选择起点；结算会尝试所有起点，保留原位置或找到可通过的位置。这里只改变比较起点，不旋转牌或规则。"],
        next: ["Next Round", "确认你已经看完揭牌结果。所有玩家都确认后，才执行显示的重试、下一关、跳过或结束。机器人只确认自己；有人掉线时会继续等待。"],
        choice: ["Continue choice", "重试(🔁 Retry)保留失败奖励；跳过(✉️ Skip to Regrets)将本关记入遗憾封套并重置奖励，主路线结束后会重新挑战。下一关(→ Next Clock)前往下一个钟盘；End Journey 结束路线。修改继续方式会清空已有确认。"],
        reserve: ["Two-player reserve", "备用牌(✉️ Reserve)：两人局各有两张未查看的牌。双方各出完两张（全队第 4 张落下）后，同时加入手牌。未知数值(?)连本人也不能提前看到。"],
        quota: ["Face-up allowance", "明牌额度(👁)：已使用次数／全队总额度。太阳(☀️)和月亮(🌙)牌共用额度。通常总额度等于人数，重试奖励最多 +3；禁止明牌(🙈)的关卡始终为 0。"],
        regrets: ["Regrets", "遗憾封套(✉️ Regrets)记录跳过的钟盘数量；主路线完成后会依次重访。它与两人局的备用牌(✉️ Reserve)用途不同。"],
        players: ["Players", "讨论中(💬 Planning)、已准备并保持静默(🤫 Ready)、当前出牌者(▶ Playing)、已确认继续(✓ Ready)。机器人(🤖)也只确认自己的回合。牌背太阳(☀️)／月亮(🌙)颜色公开，备用牌(✉️)显示剩余数量。"],
        metric: ["Clock values", "总和(Σ)是时段中所有牌的数值相加；差值(Δ)是两张牌的大数减小数。从起点(🧭)顺时针(↻)比较，后一段必须大于等于(≥)前一段，允许相等。上限(≤)始终约束总和；无上限(∞)表示本关不限制总和。"],
        checks: ["Revealed checks", "通过(✓)与未通过(✕)表示揭牌后的条件判定。未通过的条件直接列出；展开 Passed checks 可以查看已通过的条件。所有人确认 Next Round 后才继续。"],
        rules: ["Clock rules", "禁止明牌(🙈)：只能暗置。先出最大(⬆️)／最小(⬇️)：每次从自己的当前手牌中选最大／最小值。自由指针(🧭)：可改变比较起点。具体数量、颜色、区间和落点要求见各时段。"],
    };

    const hints = {
        card: "太阳 Solar(☀️)／月亮 Lunar(🌙)各有 1–12。未知(?)在 Ready 后可见；选一张牌和一个时段，再确认放置。",
        players: "讨论(💬) → 静默(🤫) → 出牌(▶)。确认继续(✓)，机器人(🤖)。牌背太阳(☀️)／月亮(🌙)公开，备用牌(✉️)暂不看。",
        metric: "总和(Σ)：牌值相加；差值(Δ)：大数减小数。顺时针(↻)非递减，可相等。上限(≤)约束总和；∞ 表示无上限。",
        quota: "明牌(👁)：已用／总额度，全队共享。重试最多 +3；禁止明牌(🙈)时为 0。",
        reserve: "备用牌(✉️ Reserve)：两人局各 2 张；全队放完第 4 张后加入手牌，此前数值(?)保密。",
        regrets: "遗憾封套(✉️ Regrets)：跳过的钟盘数；完成主路线后会重新挑战。",
        plan: "公共目标(🎯)仅供参考，不参与胜负。+／− 调整数值；首位玩家 Ready 后锁定。",
        hand: "起点(🧭 / START)决定顺时针(↻)比较顺序。看牌前可调整；结算也会尝试其他起点。",
        rules: "禁明牌(🙈)；先出手中最大(⬆️)／最小(⬇️)；自由指针(🧭)可改变起点。",
    };

    const helpHTML = `
        <p><strong>🤝 合作目标</strong>：共同把 12 张牌放到六个时段。太阳 ☀️ 和月亮 🌙 各有 1–12，每次从 24 张中随机发 12 张。牌背颜色公开。</p>
        <p><strong>💬 讨论</strong>：先看钟盘条件、约定策略。可以用公共目标作参考；目标不参与胜负。点击 Ready 才看自己的牌，此后保持静默。所有人准备后，任何一人都可以先出第一张，之后按座位顺序轮流。</p>
        <p><strong>🃏 放置</strong>：点击一张手牌与一个时段，再选择 Place face down 或 Place face up。每回合必须放一张，已放牌不能挪动。暗置／仅自己可见(🔒)，明置／公开可见(👁)。全队通常共享与人数相同的明牌额度。点空白或按 Esc 取消未提交的选择。</p>
        <p><strong>✉️ 两人局</strong>：每人先拿 4 张，另有 2 张不看的备用牌。双方各放两张后，同时拿起备用牌。三人各 4 张，四人各 3 张。</p>
        <p><strong>🕰️ 揭牌</strong>：每个时段至少一张。从指针起顺时针，六段总和应非递减（允许相等），每段通常最多 24。还要满足钟盘上的数量、颜色和目标条件。结算前不会替你预检隐藏数字。</p>
        <p><strong>🌅 官方入门</strong>：Chapter 1 · Clock 1。第一时段恰好一张太阳牌，最后时段恰好三张牌；这一关总和没有 24 的上限。</p>
        <p><strong>🧩 练习</strong>：其余 11 个钟盘是本项目的原创练习配置，并非官方 2–40 关。包含区间、最近目标（允许并列）、禁明牌、指定首尾落点、先出最高／最低牌、极值、自由指针和双牌差值。当前钟盘会直接显示条件。</p>
        <p><strong>🧭 自由指针／差值</strong>：可以在看牌前选起点；结算也会尝试六个起点。差值关每段必须两张，按较大数减较小数比较先后，其他条件依旧看牌面总和。</p>
        <p><strong>🔁 失败与遗憾</strong>：每次失败让下次重试多一次明牌，最多 +3。禁明牌关仍不能明牌。成功或跳过清空奖励。跳过的关卡会在主路线之后重访。</p>
        <p><strong>⏸ 回顾</strong>：揭牌后暂停，所有玩家点击 Next Round 才继续。修改继续方式会清空确认。End Journey 可以结束本次路线，结果会标明还有多少关未完成。</p>
        <p><strong>图标与缩写</strong>：太阳 Solar(☀️)、月亮 Lunar(🌙)、未知数值(?)、总和(Σ)、差值(Δ)、起点(🧭 / START)、顺时针序号(↻)、大于等于(≥)、上限(≤)、无上限(∞)、通过(✓ / ✅)、未通过(✕ / 🔎)、公共目标(🎯)、备用牌(✉️ Reserve)、遗憾封套(✉️ Regrets)、禁止明牌(🙈)、先出最大(⬆️)／最小(⬇️)、机器人(🤖)、放置顺序(#)。</p>
        <p><strong>Controls</strong>：悬停图标旁的说明按钮(ⓘ)或已放置的牌即可查看简短说明；手机轻点后显示 3 秒，连续轻点更新为最新说明。Explain 模式下所有游戏操作暂停，灰色按钮也可解释；点选一个解释或按 Esc 退出。对话框支持 Esc 或点击外部关闭。</p>
        <p><a href="https://www.libellud.com/en/resources/take-time/" target="_blank" rel="noopener noreferrer">Official rules & resources</a></p>`;

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
    }

    function button(text, action, explanation, disabled = false, extra = "") {
        return `<button type="button" data-tt-action="${action}" data-tt-explain="${explanation}" ${disabled ? "disabled" : ""} ${extra}>${text}</button>`;
    }

    function info(text, description, explanation, extra = "") {
        if (description === explanations[explanation]?.[1]) description = hints[explanation] || description;
        return `<button type="button" class="take-time-info" data-tt-tip="${esc(description)}" data-tt-explain="${explanation}" ${extra}>${text}</button>`;
    }

    function infoIcon(description, explanation, label) {
        return info("ⓘ", description, explanation, `aria-label="${esc(label)}"`);
    }

    function segmentDescription(index) {
        const labels = view.clock.segments[index].labels;
        return `时段 ${index + 1}：${labels.length ? labels.join("；") : "至少一张牌"}。太阳(☀️)，月亮(🌙)。起点(🧭 / START)开始，按顺时针序号(↻)比较；允许相等。`;
    }

    function available(action) {
        return !pending && Boolean(view?.legal_actions.includes(action));
    }

    function playerName(id) {
        return view?.players.find(player => player.player_id === id)?.name || "Player";
    }

    function cardHTML(card, small = false) {
        const face = card.value == null ? "?" : card.value;
        const icon = card.color === "solar" ? "☀️" : "🌙";
        const marker = card.owner ? (card.face_up || view.result ? "👁" : card.value != null ? "🔒" : "") : "";
        const content = `<span>${icon}</span><strong>${face}</strong>${marker ? `<small>${marker}</small>` : ""}`;
        if (small) {
            const label = `${card.color === "solar" ? "太阳 Solar(☀️)" : "月亮 Lunar(🌙)"} · ${face === "?" ? "未知数值(?)" : face}${card.owner ? ` · ${playerName(card.owner)} · 放置顺序 #${card.order}` : " · 备用牌(✉️ Reserve)"}${marker === "🔒" ? " · 仅自己可见(🔒)" : marker === "👁" ? " · 公开可见(👁)" : " · 数值尚未公开"}`;
            return `<button type="button" class="take-time-mini ${card.color}" data-tt-tip="${esc(label)}" data-tt-explain="card" aria-label="${esc(label)}">${content}</button>`;
        }
        const disabled = !available("place") || !view.legal_card_ids.includes(card.id);
        return button(content, "card", "card", disabled,
            `class="take-time-card ${card.color} ${selectedCard === card.id ? "selected" : ""}" data-card="${esc(card.id)}" aria-pressed="${selectedCard === card.id}" aria-label="${esc(`${icon} ${face}`)}"`);
    }

    function boardHTML() {
        const start = view.result?.hand_segment ?? view.hand_segment;
        const sectors = view.board.map((cards, index) => {
            const result = view.result?.segments[index];
            const order = (index - start + 6) % 6 + 1;
            const labels = view.clock.segments[index].labels;
            const selected = selectedSegment === index;
            const disabled = !available("place") || !view.legal_segments.includes(index);
            const total = result ? info(`${view.clock.metric === "difference" ? `Δ ${result.value} · Σ ${result.sum}` : `Σ ${result.sum}`} ${result.passed ? "✓" : "✕"}`, `${explanations.metric[1]} ${result.passed ? "通过(✓)" : "未通过(✕)"}`, "metric", 'data-tt-total="true"')
                : `<span class="take-time-count">${cards.length} ${cards.length === 1 ? "card" : "cards"}</span>`;
            const passed = result?.checks.filter(check => check.passed) || [];
            const failed = result?.checks.filter(check => !check.passed) || [];
            const checks = result ? `<div class="take-time-checks">${failed.map(check => `<span class="fail">✕ ${esc(check.label)}</span>`).join("")}${passed.length ? `<details><summary data-tt-explain="checks">✓ ${passed.length} passed checks</summary>${passed.map(check => `<span class="pass">✓ ${esc(check.label)}</span>`).join("")}</details>` : ""}</div>` : "";
            return `<div class="take-time-sector take-time-sector-${index} ${selected ? "selected" : ""} ${result ? result.passed ? "passed" : "failed" : ""}">
                <div class="take-time-sector-heading">${button(`<strong>${index === start ? "🧭" : ""} ${index + 1}</strong><small>${order === 1 ? "START" : `↻ ${order}`}</small>`, "sector", "sector", disabled, `data-segment="${index}" aria-pressed="${selected}" aria-label="Select segment ${index + 1}, ${cards.length} cards"`)}${infoIcon(segmentDescription(index), "sector", `Segment ${index + 1} rules and order`)}</div>
                <span class="take-time-sector-rules">${labels.length ? labels.map(label => `<span>${esc(label)}</span>`).join("") : "至少一张"}</span>
                <span class="take-time-pile">${cards.map(card => cardHTML(card, true)).join("") || '<span class="take-time-empty">＋</span>'}</span>
                ${total}${checks}
            </div>`;
        }).join("");
        return `<div class="take-time-clock" aria-label="Six clock segments, clockwise from the hand">${sectors}
            <div class="take-time-clock-center"><div class="take-time-dial" aria-hidden="true"><span>🕰️</span></div><strong>${view.clock.metric === "difference" ? "DIFFERENCES" : "TAKE TIME"}</strong>
            <span>${view.placed_count} / 12 cards</span>${info(`↻ ${view.clock.metric === "difference" ? "Δ 差值" : "Σ 总和"}递增 · 可相等`, explanations.metric[1], "metric")}
            ${info(view.clock.cap === null ? "∞ 无总和上限" : `Σ ≤ ${view.clock.cap}`, explanations.metric[1], "metric")}</div></div>`;
    }

    function playersHTML() {
        return view.players.map(player => {
            const own = player.player_id === view.you;
            const status = view.phase === "discussion" ? player.ready ? "🤫 Ready" : "💬 Planning"
                : view.result ? player.next_ready ? "✓ Ready" : "Reviewing"
                : player.player_id === view.current_turn ? "▶ Playing" : `${player.hand.length} in hand`;
            return `<div class="take-time-player ${player.player_id === view.current_turn ? "active" : ""}">
                <div><strong>${esc(player.name)}${own ? " · You" : ""}${player.is_bot ? " 🤖" : ""}</strong><small>${status}</small></div>
                ${info(`${player.hand.map(card => card.color === "solar" ? "☀️" : "🌙").join(" ") || "0 cards"}${player.reserve.length ? ` · ✉️ ${player.reserve.length}` : ""}`, explanations.players[1], "players", 'aria-label="Card backs and player status"')}</div>`;
        }).join("");
    }

    function planHTML() {
        const locked = !available("set_plan");
        return `<details class="take-time-details take-time-plan" data-detail="plan" ${planOpen ? "open" : ""}><summary data-tt-explain="plan">Shared plan ${locked ? "· Locked" : "· Optional"}</summary>
            <div class="take-time-plan-label">${info("🎯 Targets", explanations.plan[1], "plan")}<span>Optional reference</span></div><div class="take-time-plan-grid">${view.targets.map((target, index) => {
                const segment = (index + view.hand_segment) % 6;
                return `<div class="take-time-plan-cell"><span>Segment ${segment + 1}</span><div>${button("−", "plan", "plan", locked || target <= 0, `data-index="${index}" data-delta="-1" aria-label="Lower target ${segment + 1}"`)}<strong>${target}</strong>${button("+", "plan", "plan", locked || target >= 36, `data-index="${index}" data-delta="1" aria-label="Raise target ${segment + 1}"`)}</div></div>`;
            }).join("")}</div>${view.clock.movable_hand ? `<div class="take-time-hand-picker"><span>Clock hand ${infoIcon(explanations.hand[1], "hand", "Clock hand and starting segment")}</span>${[0, 1, 2, 3, 4, 5].map(index => button(String(index + 1), "hand", "hand", !available("set_hand"), `data-segment="${index}" aria-pressed="${view.hand_segment === index}"`)).join("")}</div>` : ""}</details>`;
    }

    function actionHTML() {
        const own = view.players.find(player => player.player_id === view.you);
        if (!own) return '<p class="take-time-notice">Spectating · Private card values are hidden.</p>';
        if (view.result) {
            const choices = {retry: "🔁 Retry", advance: "→ Next Clock", skip: "✉️ Skip to Regrets", finish: "End Journey"};
            if (view.game_over) {
                return `<div class="take-time-result-title">${view.journey_complete ? "🏆 Journey complete" : "Journey ended"}</div><p>${view.completed.length} / ${view.itinerary.length} clocks passed${view.journey_complete ? "." : ` · ${view.itinerary.length - view.completed.length} unfinished.`}</p>`;
            }
            const waiting = view.players.filter(player => !player.next_ready).map(player => player.name).join(", ");
            return `<div class="take-time-result-title">${view.result.success ? "✅ Test passed" : "🔎 Try again"}</div>
                <p>${view.result.success ? "已满足本关所有条件。" : `查看钟盘上的红色条件。重试奖励 +${view.bonus}${view.clock.no_face_up ? "；本关仍禁止明牌" : " 次明牌"}。`}</p>
                ${view.result.hand_segment !== view.result.planned_hand ? `<p>🧭 结算起点调整为时段 ${view.result.hand_segment + 1}。</p>` : ""}
                <div class="take-time-choice-row">${view.next_choices.map(choice => button(choices[choice], "choice", "choice", !available("choose_next"), `data-choice="${choice}" aria-pressed="${view.next_choice === choice}"`)).join("")}</div>
                <p class="take-time-next-summary">Continue: <strong>${choices[view.next_choice]}</strong></p>
                ${button(`Next Round · ${view.next_ready.length}/${view.players.length}`, "next", "next", !available("next_round"), 'class="take-time-primary take-time-next"')}
                <p class="take-time-waiting">${own.next_ready ? "Your confirmation is saved. " : "Review the revealed cards before continuing. "}${waiting ? `Waiting: ${esc(waiting)}` : ""}</p>`;
        }
        const handTitle = `<h3>Your hand ${infoIcon(explanations.card[1], "card", "Card colors, hidden values and selection")}</h3>`;
        const reserve = own.reserve.length ? `<div class="take-time-reserve">${info(`✉️ Reserve · ${own.reserve.length}`, explanations.reserve[1], "reserve")}${own.reserve.map(card => cardHTML(card, true)).join("")}</div>` : "";
        if (view.phase === "discussion") {
            return `${handTitle}<p class="take-time-hand-status">${own.ready ? "🤫 Keep silent · Waiting for everyone" : "💬 Discuss together before looking"}</p>
                <div class="take-time-hand">${own.hand.map(card => cardHTML(card)).join("")}</div>${reserve}
                ${button(own.ready ? "Ready · Waiting" : "Ready · Look at cards", "ready", "ready", !available("ready"), 'class="take-time-primary take-time-next"')}`;
        }
        const selected = own.hand.find(card => card.id === selectedCard);
        const canPlace = available("place") && selected && selectedSegment !== null;
        const quota = view.face_up_limit - view.face_up_used;
        const description = selected ? `${selected.color === "solar" ? "☀️" : "🌙"} ${selected.value}${selectedSegment !== null ? ` → Segment ${selectedSegment + 1}` : " · Choose a segment"}`
            : selectedSegment !== null ? `Segment ${selectedSegment + 1} · Choose a card` : "Choose a card, then a segment";
        return `${handTitle}<div class="take-time-hand">${own.hand.map(card => cardHTML(card)).join("")}</div>${reserve}
            <p class="take-time-selection" aria-live="polite">${description}</p><div class="take-time-place-actions">
            ${button("🔒 Place face down", "down", "down", !canPlace, 'class="take-time-primary"')}
            ${button(`👁 Place face up · ${quota}`, "up", "up", !canPlace || quota <= 0)}</div>
            <p class="take-time-hint">${pending ? "Sending…" : available("place") ? "Click empty space or press Esc to cancel." : "Waiting for your turn."}</p>`;
    }

    function render() {
        if (!view || !panel) return;
        hideTip();
        const own = view.players.some(player => player.player_id === view.you);
        let status;
        if (view.game_over) status = "Journey ended";
        else if (view.result) status = "⏸ Review the revealed clock";
        else if (view.phase === "discussion") status = "💬 Discuss before looking";
        else if (!view.current_turn) status = "🤫 Anyone may play first";
        else status = view.current_turn === view.you ? "▶ Your turn · Keep silent" : `🤫 ${playerName(view.current_turn)}'s turn`;
        const rules = [];
        if (view.clock.no_face_up) rules.push("🙈 禁止明牌");
        if (view.clock.play_order !== "any") rules.push(view.clock.play_order === "highest" ? "⬆️ 每次出手中最大牌" : "⬇️ 每次出手中最小牌");
        if (view.clock.movable_hand) rules.push("🧭 自由指针");
        if (view.clock.metric === "difference") rules.push("每段两张 · 按差值排序");
        const origin = view.clock.source === "official_1_1" ? "Official · Chapter 1 / Clock 1" : "Original practice";
        panel.innerHTML = `<div class="take-time-shell"><div class="take-time-title-row"><div><span class="take-time-eyebrow">A MOMENT, TOGETHER</span><h2>${esc(view.clock.name)}</h2><span class="take-time-origin">${origin}</span></div><div class="take-time-progress"><strong>${view.completed.length}<small> / ${view.itinerary.length}</small></strong><span>clocks passed</span></div></div>
            <div class="take-time-status"><strong role="status">${info(esc(status), explanations.players[1], "players")}</strong><span>Attempt ${view.attempt} · ${info(`👁 ${view.face_up_used}/${view.face_up_limit}`, explanations.quota[1], "quota", 'aria-label="Face-up allowance used and total"')}</span></div>
            ${rules.length ? `<div class="take-time-clock-rules">${rules.map(rule => info(rule, explanations.rules[1], "rules")).join("")}</div>` : ""}
            <div class="take-time-layout ${view.result ? "is-review" : ""}"><section class="take-time-board-area">${boardHTML()}<div class="take-time-legend">${info("☀️ Solar", "太阳 Solar(☀️)：1–12 的浅色牌，牌背颜色公开。", "card")}${info("🌙 Lunar", "月亮 Lunar(🌙)：1–12 的深色牌，牌背颜色公开。", "card")}${info("🔒 Only you", "仅自己可见(🔒)：暗置的牌只有出牌者知道数字；结算时向全员公开。", "down")}${info("👁 Public", "公开可见(👁)：所有玩家都能看到数字。", "up")}</div></section>
            <section class="take-time-action-box">${actionHTML()}</section><div class="take-time-players">${playersHTML()}</div>${planHTML()}</div>
            <div class="take-time-footer">${info(`✉️ Regrets · ${view.regrets.length}`, explanations.regrets[1], "regrets")}<span>${own ? "🤝 Win or learn together" : "Spectator"}</span></div>
            <details class="take-time-details" data-detail="log" ${logOpen ? "open" : ""}><summary>Activity</summary><ol class="take-time-log">${view.log.slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ol></details>
            </div>`;
        panel.classList.toggle("take-time-explaining", explaining);
        panel.querySelectorAll("details[data-detail]").forEach(details => details.addEventListener("toggle", () => {
            if (details.dataset.detail === "plan") planOpen = details.open;
            else logOpen = details.open;
        }));
    }

    function clearSelection() {
        if (selectedCard === null && selectedSegment === null) return;
        selectedCard = null;
        selectedSegment = null;
        render();
    }

    function setExplain(enabled) {
        explaining = enabled;
        hideTip();
        panel.classList.toggle("take-time-explaining", enabled);
        explainButton.setAttribute("aria-pressed", String(enabled));
    }

    function hideTip() {
        window.clearTimeout(tipTimer);
        window.clearTimeout(tipHideTimer);
        tipAnchor?.removeAttribute("aria-describedby");
        tipAnchor = null;
        tip.hidden = true;
    }

    function showTip(target, touch = false) {
        if (!target?.isConnected || explaining || dialog.open) return;
        hideTip();
        tipAnchor = target;
        tip.textContent = target.dataset.ttTip;
        tip.classList.toggle("is-touch", touch);
        tip.setAttribute("role", touch ? "status" : "tooltip");
        target.setAttribute("aria-describedby", tip.id);
        tip.hidden = false;
        const anchor = target.getBoundingClientRect();
        const rect = tip.getBoundingClientRect();
        const width = window.visualViewport?.width || innerWidth;
        const height = window.visualViewport?.height || innerHeight;
        const left = touch ? (width - rect.width) / 2 : anchor.left;
        const top = touch
            ? anchor.top > height / 2 ? 12 : height - rect.height - 12
            : anchor.top > rect.height + 16 ? anchor.top - rect.height - 8 : anchor.bottom + 8;
        tip.style.left = `${Math.max(12, Math.min(width - rect.width - 12, left)) + (window.visualViewport?.offsetLeft || 0)}px`;
        tip.style.top = `${Math.max(12, Math.min(height - rect.height - 12, top)) + (window.visualViewport?.offsetTop || 0)}px`;
        if (touch) tipTimer = window.setTimeout(hideTip, 3000);
    }

    function openDialog(title, content, html = false) {
        hideTip();
        returnFocus = document.activeElement;
        dialogTitle.textContent = title;
        if (html) dialogBody.innerHTML = content;
        else dialogBody.textContent = content;
        if (!dialog.open) dialog.showModal();
        dialogClose.focus();
    }

    function explainTarget(target) {
        const entry = explanations[target?.dataset.ttExplain];
        if (!entry) return;
        setExplain(false);
        const detail = target.classList.contains("take-time-mini") || target.closest(".take-time-sector-heading")?.contains(target)
            ? target.dataset.ttTip : null;
        openDialog(entry[0], detail ? `${detail}\n\n${entry[1]}` : entry[1]);
    }

    function isExplainExempt(target) {
        // The shared mobile header moves these buttons outside their original wrapper.
        return help.contains(target) || explainButton.contains(target) || dialog.contains(target);
    }

    function submit(action) {
        if (pending || !view || typeof sendAction !== "function") return;
        pending = true;
        selectedCard = null;
        selectedSegment = null;
        render();
        sendAction(action);
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; render(); }, 6000);
    }

    panel.addEventListener("click", event => {
        if (event.target.closest("summary, .take-time-checks")) return;
        const target = event.target.closest("[data-tt-action]")
            || event.target.closest(".take-time-sector")?.querySelector('[data-tt-action="sector"]');
        if (!target || target.disabled || explaining) return;
        const kind = target.dataset.ttAction;
        if (kind === "card") {
            selectedCard = selectedCard === target.dataset.card ? null : target.dataset.card;
            render();
        } else if (kind === "sector") {
            const segment = Number(target.dataset.segment);
            selectedSegment = selectedSegment === segment ? null : segment;
            render();
        } else if (kind === "ready") submit({type: "ready"});
        else if (kind === "next") submit({type: "next_round"});
        else if (kind === "choice") submit({type: "choose_next", choice: target.dataset.choice});
        else if (kind === "plan") {
            const index = Number(target.dataset.index);
            submit({type: "set_plan", segment: index, target: view.targets[index] + Number(target.dataset.delta)});
        } else if (kind === "hand") submit({type: "set_hand", segment: Number(target.dataset.segment)});
        else if ((kind === "down" || kind === "up") && selectedCard && selectedSegment !== null) {
            submit({type: "place", card_id: selectedCard, segment: selectedSegment, face_up: kind === "up"});
        }
    });

    help.addEventListener("click", () => {
        setExplain(false);
        const clockRules = view ? `<p><strong>${esc(view.clock.name)}</strong> · ${view.clock.metric === "difference" ? "按差值(Δ)" : "按总和(Σ)"}排序，${view.clock.cap === null ? "无总和上限(∞)" : `总和(Σ) ≤ ${view.clock.cap}`}。</p><ul>${view.clock.segments.map((segment, index) => `<li>时段 ${index + 1}：${esc(segment.labels.join("；") || "至少一张牌")}</li>`).join("")}</ul>` : "";
        openDialog("Take Time · Help", clockRules + helpHTML, true);
    });
    explainButton.addEventListener("click", () => setExplain(!explaining));
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });

    // Coordinate hit-testing is necessary because disabled controls do not emit click.
    document.addEventListener("pointerdown", event => {
        if (!explaining) { suppressClick = false; return; }
        if (panel.classList.contains("hidden")) return;
        if (isExplainExempt(event.target)) return;
        const target = document.elementsFromPoint(event.clientX, event.clientY)
            .map(element => element.closest("#takeTimePanel [data-tt-explain]"))
            .find(Boolean);
        event.preventDefault();
        event.stopImmediatePropagation();
        if (target) {
            suppressClick = true;
            window.clearTimeout(suppressTimer);
            suppressTimer = window.setTimeout(() => { suppressClick = false; }, 600);
            explainTarget(target);
        }
    }, true);

    document.addEventListener("click", event => {
        if (suppressClick) {
            suppressClick = false;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (!explaining) return;
        if (isExplainExempt(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (panel.contains(event.target)) explainTarget(event.target.closest("[data-tt-explain]"));
    }, true);

    document.addEventListener("pointerdown", event => {
        if (explaining || !view || !panel.contains(event.target)) return;
        if (event.target.closest("button, input, select, summary, a, .take-time-hand-picker, .take-time-sector")) return;
        clearSelection();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Tab") inputKind = "keyboard";
        if (event.key !== "Escape" || panel.classList.contains("hidden")) return;
        if (dialog.open) return;
        if (!tip.hidden) { hideTip(); return; }
        setExplain(false);
        clearSelection();
    });

    document.addEventListener("pointerover", event => {
        if (event.pointerType === "touch" || event.pointerType === "pen" || explaining) return;
        if (tip.contains(event.target) || tipAnchor?.contains(event.target)) window.clearTimeout(tipHideTimer);
        const target = event.target.closest("#takeTimePanel [data-tt-tip]");
        if (target && target !== tipAnchor) { inputKind = "mouse"; showTip(target); }
    });
    document.addEventListener("pointerout", event => {
        if (inputKind === "touch" || !tipAnchor) return;
        if ((tipAnchor.contains(event.target) || tip.contains(event.target))
            && !tipAnchor.contains(event.relatedTarget) && !tip.contains(event.relatedTarget)) {
            tipHideTimer = window.setTimeout(hideTip, 150);
        }
    });
    document.addEventListener("focusin", event => {
        const target = event.target.closest("#takeTimePanel [data-tt-tip]");
        if (target && inputKind !== "touch") showTip(target);
    });
    document.addEventListener("focusout", event => {
        if (inputKind !== "touch" && tipAnchor?.contains(event.target)) hideTip();
    });
    document.addEventListener("pointerdown", event => {
        if (explaining || panel.classList.contains("hidden")) return;
        inputKind = ["touch", "pen"].includes(event.pointerType) ? "touch" : "mouse";
        const target = event.target.closest("#takeTimePanel [data-tt-tip]");
        if (target && inputKind === "touch") {
            touchStart = {id: event.pointerId, target, x: event.clientX, y: event.clientY, moved: false};
        } else if (!target && !tip.contains(event.target)) hideTip();
    }, true);
    document.addEventListener("pointermove", event => {
        if (touchStart?.id === event.pointerId
            && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) {
            touchStart.moved = true;
            hideTip();
        }
    }, true);
    document.addEventListener("pointerup", event => {
        if (!touchStart || touchStart.id !== event.pointerId) return;
        const start = touchStart;
        touchStart = null;
        if (!start.moved && start.target.isConnected && !explaining) showTip(start.target, true);
    }, true);
    document.addEventListener("pointercancel", () => { touchStart = null; }, true);
    document.addEventListener("click", event => {
        const target = event.target.closest("#takeTimePanel [data-tt-tip]");
        if (!target || explaining) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (inputKind !== "touch" || event.detail === 0) showTip(target);
    }, true);
    document.addEventListener("scroll", () => {
        if (touchStart) touchStart.moved = true;
        if (inputKind !== "touch") hideTip();
    }, true);
    window.addEventListener("resize", hideTip);
    window.visualViewport?.addEventListener("resize", hideTip);

    function clearState() {
        view = null;
        version = null;
        selectedCard = null;
        selectedSegment = null;
        pending = false;
        planOpen = false;
        logOpen = false;
        touchStart = null;
        window.clearTimeout(pendingTimer);
        window.clearTimeout(suppressTimer);
        suppressClick = false;
        setExplain(false);
        if (dialog.open) dialog.close();
        panel.innerHTML = "";
    }

    window.renderTakeTimeGameState = data => {
        if (!data?.view) return;
        const nextVersion = `${data.room_id}:${data.state_version}`;
        if (version !== nextVersion) { selectedCard = null; selectedSegment = null; }
        version = nextVersion;
        view = data.view;
        pending = false;
        window.clearTimeout(pendingTimer);
        render();
    };
    window.showTakeTimeHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clearState();
    };
    window.clearTakeTimeState = clearState;
    window.getTakeTimeConfig = () => ({start_clock: document.getElementById("takeTimeStartClock").value});
    window.updateTakeTimeConfigRow = () => {
        const visible = currentGameType === "take_time" && currentRoomState?.status === "lobby";
        configBox.classList.toggle("hidden", !visible);
        configBox.setAttribute("aria-hidden", String(!visible));
    };
    if (typeof socket !== "undefined") socket.on("system:error", () => {
        if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); }
    });
})();
