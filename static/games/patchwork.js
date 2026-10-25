(() => {
    "use strict";

    const byId = suffix => document.getElementById(`patchwork${suffix}`);
    const panel = byId("Panel");
    const dialogs = [byId("HelpModal"), byId("ExplainModal"), byId("QuiltModal")];
    const tooltip = byId("Tooltip");
    const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[char]);
    const label = patchId => `布块 ${Number(String(patchId).split("_").at(-1))}`;
    const tip = message => `data-patchwork-tip="${escape(message)}" tabindex="0"`;
    const explanations = {
        market: ["布块市场", "只可购买中立标记之后的三块布。上方为价格（🔘）与时间成本（⏳），下方为新增收入（↑🔘）与覆盖面积（⬜）。选定后在拼布上预览，Confirm 才购买。后续布块按市场顺序展示，购买后标记移动到所购布块之后。"],
        quilt: ["拼布与旋转中心", "点击格子，把布块靠近重心的一格（✚）放到该位置；旋转和翻转保持这格固定。绿色预览可放置，红色表示重叠或越界。预览旁仍显示完整形状。点击空白处或按 Esc 取消。皮革补丁（🟫）也先预览再 Confirm。"],
        rotate: ["Rotate · 顺时针旋转", "每次顺时针旋转 90°，围绕标有 ✚ 的实格旋转。四次旋转回到原位。可以先旋转，再在拼布上选择位置。"],
        flip: ["Flip · 水平翻转", "把屏幕上的布块左右镜像，保持 ✚ 中心格固定。两次翻转回到原位。"],
        move: ["Move · 移动预览", "点击 ↑ ↓ ← → 让已选布块或皮革补丁沿棋盘移动一格；固定中心格和当前旋转、翻转保持不变。移动到越界或重叠的位置时，Confirm 会保持禁用。"],
        confirm: ["Confirm · 确认摆放", "布块必须完全在棋盘内且不能覆盖已有布块，纽扣（🔘）也须足够。确认才提交购买或皮革补丁（🟫）摆放。等待服务器响应时不能重复操作。"],
        advance: ["⏩ 前进", "不买布块，前进到对手前方一格，最多到终点。每前进一格得到一枚纽扣（🔘）；经过收入标记时还会获得当前收入。遇到未领取的皮革补丁（🟫）会先暂停，摆放补丁后再完成剩余移动。"],
        track: ["⏳ 时间轨道", "按数字沿蛇形轨道从 0 前进到 53。落后者行动，同格时后到者先行动。经过纽扣（🔘）标记获得收入，首个经过未领取皮革（🟫）的人获得一格补丁。灰色皮革格表示已领取。两人均到终点后结算。"],
        players: ["双方进度与得分", "纽扣（🔘）是货币，收入（↑🔘）是每次经过收入点所得纽扣，时间（⏳）是当前位置。空格（⬜）每格扣 2 分，首个填满 7×7 方形的人获得奖励（⭐）。得分（🏁）= 纽扣 − 空格×2 + 奖励。同分时先到终点者获胜。Quilt 可查看对方拼布。"],
    };
    const help = `
        <h3>目标</h3><p>在 9×9 拼布上拼出尽量完整的被子。两人到时间轨道终点后结算：纽扣（🔘）− 空格（⬜）×2 + 7×7 奖励（⭐）。同分时先到终点者获胜。</p>
        <h3>谁行动</h3><p>时间（⏳）落后者行动；同格时后到者先行动，因此一人可能连续行动。本游戏没有独立轮次结算，终局结果保留在界面供双方查看。</p>
        <h3>两种行动</h3><ul><li>⏩ 前进：移动到对手前一格，最多到 53；每步获得 🔘1，经过收入点还会收取收入。</li><li>购买：选市场前三块之一，支付上方价格（🔘），把整块放入空白处，再支付时间（⏳）。下方 ↑🔘 是新增收入，⬜ 是覆盖面积；所购布块之后成为新的市场起点。</li></ul>
        <h3>轨道奖励</h3><ul><li>纽扣标记（🔘）：每次到达或经过，收取当前纽扣收入（↑🔘），包含刚买布块的收入。</li><li>皮革补丁（🟫）：首个经过者免费放置一个 1×1 补丁，再继续移动。没有空格时不领取。</li><li>7×7 奖励（⭐）：首个填满任意 7×7 方形的人获得 +7 分。</li></ul>
        <h3>摆放与查看</h3><p>选布块 → 点击棋盘 → 用 ↑ ↓ ← → 微调位置 → Rotate / Flip → Confirm。✚ 是靠近布块重心的固定实格。绿色表示可以摆放，红色表示重叠或越界；皮革补丁也要 Confirm。点击空白处或按 Esc 取消预览。</p><p>Quilt 查看对方棋盘；展开后续布块可以看完整形状和顺序。Help 显示规则；Explain 后点击区域或按钮查看解释。静态图标悬停或轻点显示说明，手机说明 3 秒消失。Esc 关闭对话框。</p>`;

    let view = null;
    let roomKey = null;
    let signature = "";
    let selected = null;
    let rotation = 0;
    let flipped = false;
    let pivot = null;
    let pending = false;
    let awaitingResync = false;
    let explaining = false;
    let pointer = null;
    let suppressClickUntil = 0;
    let tipTarget = null;
    let tipTimer = null;
    let focusBeforeDialog = null;
    let inspectedPlayer = null;
    let activity = "";

    const active = () => typeof currentGameType !== "undefined" && currentGameType === "patchwork" && !panel.classList.contains("hidden");
    const connected = () => typeof socket !== "undefined" && socket.connected && !awaitingResync && (typeof roomSessionReady === "undefined" || roomSessionReady);
    const own = () => view?.players.find(player => player.player_id === view.you);
    const isTurn = () => !!own() && !view.game_over && view.current_turn === view.you;
    const bonus = () => isTurn() && view.pending_special_patch?.player_id === view.you;
    const can = type => isTurn() && connected() && !pending && view.legal_actions.includes(type);
    const canSelect = () => isTurn() && connected() && !pending && !view.pending_special_patch;
    const playerName = playerId => view?.players.find(player => player.player_id === playerId)?.name || playerId || "—";
    const definition = () => bonus() ? {id: "leather", cells: [[0, 0]], cost_buttons: 0, cost_time: 0, income_buttons: 0} : view?.patch_defs[selected];
    const score = player => view.scores?.[player.player_id] ?? player.score_preview;

    function setError(message = "") {
        byId("Error").textContent = message;
        byId("Error").hidden = !message;
    }

    function clearDraft() {
        selected = null;
        pivot = null;
        rotation = 0;
        flipped = false;
    }

    function transformed(def) {
        const cells = def.cells;
        const center = cells.reduce((sum, cell) => [sum[0] + cell[0] / cells.length, sum[1] + cell[1] / cells.length], [0, 0]);
        let pivotIndex = 0;
        cells.forEach((cell, index) => {
            if (Math.hypot(cell[0] - center[0], cell[1] - center[1]) < Math.hypot(cells[pivotIndex][0] - center[0], cells[pivotIndex][1] - center[1])) pivotIndex = index;
        });
        const raw = cells.map(([column, row]) => {
            let point = [flipped ? -column : column, row];
            for (let turn = 0; turn < rotation / 90; turn++) point = [point[1], -point[0]];
            return point;
        });
        const minColumn = Math.min(...raw.map(cell => cell[0]));
        const minRow = Math.min(...raw.map(cell => cell[1]));
        const normalized = raw.map(cell => [cell[0] - minColumn, cell[1] - minRow]);
        return {cells: normalized, pivot: normalized[pivotIndex]};
    }

    function placement() {
        const def = definition();
        if (!def || !pivot) return null;
        const shape = transformed(def);
        const origin = [pivot[0] - shape.pivot[0], pivot[1] - shape.pivot[1]];
        const cells = shape.cells.map(cell => [cell[0] + origin[0], cell[1] + origin[1]]);
        const board = own()?.quilt_board;
        const valid = !!board && cells.every(([column, row]) => row >= 0 && column >= 0 && row < view.board_size && column < view.board_size && board[row][column] === null);
        return {origin, cells, valid};
    }

    function palette(key) {
        if (String(key).startsWith("leather")) return {fill: "#be966a", stroke: "#79552d"};
        const hue = (Number(String(key).split("_").at(-1)) * 47) % 360;
        return {fill: `hsl(${hue} 44% 71%)`, stroke: `hsl(${hue} 34% 39%)`};
    }

    function shapeMarkup(cells, key, small = false, center = null) {
        const width = Math.max(...cells.map(cell => cell[0])) + 1;
        const height = Math.max(...cells.map(cell => cell[1])) + 1;
        const unit = Math.min(small ? 14 : 18, Math.floor((small ? 42 : 56) / Math.max(width, height)));
        const colors = palette(key);
        return `<div class="patchwork-shape" aria-hidden="true" style="--cols:${width};--rows:${height};--unit:${unit}px;--fill:${colors.fill};--stroke:${colors.stroke}">${cells.map(([column, row]) => `<span class="patchwork-shape-cell${center?.[0] === column && center?.[1] === row ? " pivot" : ""}" style="--col:${column};--row:${row}"></span>`).join("")}</div>`;
    }

    function renderMarket() {
        const upcomingScroll = byId("UpcomingMarket").scrollTop;
        const available = [];
        const upcoming = [];
        for (const entry of view.patch_circle) {
            const def = view.patch_defs[entry.patch_id];
            const selectable = view.selectable_patches.includes(def.id);
            const description = `${label(def.id)}，价格 🔘${def.cost_buttons}，时间 ⏳${def.cost_time}，收入 ↑🔘${def.income_buttons}，面积 ⬜${def.cell_count}`;
            const body = `<span class="patchwork-market-card-header"><strong>${escape(label(def.id))}</strong><span class="patchwork-market-order">${entry.offset + 1}</span></span>
                <span class="patchwork-market-cost"><span>🔘 ${def.cost_buttons}</span><span>⏳ ${def.cost_time}</span></span>
                <span class="patchwork-market-image">${shapeMarkup(def.cells, def.id)}</span>
                <span class="patchwork-market-income"><span>↑🔘 ${def.income_buttons}</span><span>⬜ ${def.cell_count}</span></span>`;
            if (selectable) {
                available.push(`<button type="button" class="patchwork-market-card selectable${own() && own().buttons < def.cost_buttons ? " unaffordable" : ""}" data-patch-id="${escape(def.id)}" data-patchwork-explain="market" aria-label="${escape(description)}">${body}</button>`);
            } else {
                upcoming.push(`<div class="patchwork-market-card upcoming" data-patchwork-explain="market" ${tip(description)}>${body}</div>`);
            }
        }
        byId("Market").innerHTML = available.join("") || '<span class="patchwork-hint">市场已空，可选择前进。</span>';
        byId("UpcomingMarket").innerHTML = upcoming.join("");
        byId("UpcomingMarket").scrollTop = upcomingScroll;
        byId("UpcomingCount").textContent = String(upcoming.length);
    }

    function stat(icon, value, description) {
        return `<span class="patchwork-stat" ${tip(description)}>${icon} <strong>${value}</strong></span>`;
    }

    function renderPlayers() {
        byId("Players").innerHTML = view.players.map((player, index) => `<article class="patchwork-player-card seat-${index}${view.current_turn === player.player_id ? " active" : ""}" data-patchwork-explain="players">
            <div class="patchwork-player-heading"><strong class="patchwork-player-name">${escape(playerName(player.player_id))}${player.player_id === view.you ? " · YOU" : ""}</strong><button type="button" class="patchwork-view-quilt" data-player-id="${escape(player.player_id)}" data-patchwork-explain="players">Quilt</button></div>
            <div class="patchwork-player-stats">${stat("🔘", player.buttons, "纽扣：可用于购买，终局每枚得 1 分。")}${stat("↑🔘", player.button_income, "收入：每经过收入点得到这些纽扣。")}${stat("⏳", player.time_position, `时间：当前位置 / ${view.track_end}，落后者行动。`)}${stat("⬜", player.empty_spaces, "空格：每格在终局扣 2 分。")}${stat("⭐", player.has_special_tile ? view.special_tile_bonus : 0, "7×7 奖励：首个填满 7×7 方形者获得。")}${stat("🏁", score(player), view.game_over ? "最终得分。" : "当前得分：纽扣 − 空格×2 + 奖励。")}</div>
            <div class="patchwork-progress" aria-hidden="true"><span style="--progress:${100 * player.time_position / view.track_end}%"></span></div></article>`).join("");
        const you = own();
        byId("Wallet").innerHTML = you ? stat("🔘", you.buttons, "纽扣：当前可用于购买的数量。") + stat("↑🔘", you.button_income, "收入：每经过收入点所得纽扣。") : "Spectating";
        const rewardParts = [];
        if (you) {
            const income = view.button_markers.find(position => position > you.time_position);
            const leather = view.leather_markers.find(position => position > you.time_position && !view.claimed_leathers.includes(position));
            if (income != null) rewardParts.push(`<span ${tip(`再走 ${income - you.time_position} 格，可获得收入 🔘${you.button_income}。`)}>🔘 收入 ${income - you.time_position} 步</span>`);
            if (leather != null) rewardParts.push(`<span ${tip("下个尚未领取的皮革补丁，先经过者获得。")}>🟫 ${leather - you.time_position} 步</span>`);
        }
        rewardParts.push(`<span ${tip("首个填满 7×7 方形者获得奖励。")}>⭐ 7×7 ${view.special_tile_available ? "待领取" : "已领取"}</span>`);
        if (view.first_to_finish) rewardParts.push(`<span ${tip("先到终点者在终局同分时获胜。")}>🏁 ${escape(playerName(view.first_to_finish))}</span>`);
        byId("Rewards").innerHTML = rewardParts.join("");
        byId("Activity").textContent = activity;
    }

    function renderTrack() {
        const cells = [];
        for (let position = 0; position <= view.track_end; position++) {
            const row = Math.floor(position / 9);
            const column = row % 2 ? 8 - position % 9 : position % 9;
            const income = view.button_markers.includes(position);
            const leather = view.leather_markers.includes(position);
            const claimed = view.claimed_leathers.includes(position);
            const occupants = view.players.filter(player => player.time_position === position);
            const description = `时间 ${position}${income ? "，纽扣收入 🔘" : ""}${leather ? `，皮革补丁 🟫${claimed ? "已领取" : "待领取"}` : ""}${occupants.map(player => `，${playerName(player.player_id)}`).join("")}`;
            cells.push(`<div class="patchwork-track-space${income ? " income" : ""}${leather ? " leather" : ""}${claimed ? " claimed" : ""}" style="grid-column:${column + 1};grid-row:${row + 1}" data-position="${position}" data-patchwork-explain="track" ${tip(description)}><span class="patchwork-track-label"><span>${position}</span><span>${income ? "🔘" : leather ? claimed ? "✓" : "🟫" : ""}</span></span><span class="patchwork-track-tokens">${occupants.map(player => `<span class="patchwork-track-token seat-${view.players.indexOf(player)}">${view.players.indexOf(player) + 1}</span>`).join("")}</span></div>`);
        }
        byId("Track").innerHTML = cells.join("");
        byId("TrackProgress").textContent = view.players.map(player => `${player.time_position}/${view.track_end}`).join(" · ");
    }

    function renderBoard(target, player, interactive) {
        if (!player) { target.replaceChildren(); return; }
        const size = view.board_size;
        const tag = interactive ? "BUTTON" : "DIV";
        if (target.children.length !== size * size || target.firstElementChild.tagName !== tag) {
            target.innerHTML = Array.from({length: size * size}, (_, index) => `<${tag.toLowerCase()} ${interactive ? 'type="button"' : ""} class="patchwork-board-cell" data-column="${index % size}" data-row="${Math.floor(index / size)}"></${tag.toLowerCase()}>`).join("");
        }
        const draft = interactive ? placement() : null;
        const preview = new Set(draft?.cells.map(cell => cell.join(",")) || []);
        [...target.children].forEach((cell, index) => {
            const column = index % size;
            const row = Math.floor(index / size);
            const occupied = player.quilt_board[row][column];
            cell.className = "patchwork-board-cell";
            cell.classList.toggle("filled", !!occupied);
            cell.classList.toggle("preview", preview.has(`${column},${row}`));
            cell.classList.toggle("invalid", preview.has(`${column},${row}`) && !draft.valid);
            cell.classList.toggle("pivot", interactive && pivot?.[0] === column && pivot?.[1] === row);
            cell.classList.toggle("bonus-target", interactive && bonus() && !occupied);
            if (occupied) {
                const colors = palette(occupied);
                cell.style.setProperty("--fill", colors.fill);
                cell.style.setProperty("--stroke", colors.stroke);
            } else cell.removeAttribute("style");
            cell.setAttribute("aria-label", `第 ${row + 1} 行，第 ${column + 1} 列，${occupied ? "已填充" : "空格"}${preview.has(`${column},${row}`) ? "，预览" : ""}`);
            if (interactive) cell.disabled = !isTurn() || !connected() || pending || !(selected || bonus()) || (!!bonus() && !!occupied);
        });
    }

    function renderDraft() {
        if (!view) return;
        const you = own();
        const def = definition();
        const draft = placement();
        const actionable = bonus() ? can("place_bonus_patch") : can("buy_patch");
        const affordable = !!def && !!you && you.buttons >= def.cost_buttons;
        byId("Turn").textContent = !connected() ? "Disconnected · Reconnecting…" : view.game_over ? "Game over" : pending ? "Submitting…" : !you ? `Spectating · ${playerName(view.current_turn)}` : isTurn() ? bonus() ? "轮到你 · 放置皮革补丁" : "轮到你" : `等待 ${playerName(view.current_turn)}`;
        document.body.classList.toggle("patchwork-turn-active", active() && isTurn() && connected() && !pending);
        panel.querySelectorAll("#patchworkMarket [data-patch-id]").forEach(card => {
            card.disabled = !canSelect();
            card.classList.toggle("selected", card.dataset.patchId === selected);
            card.setAttribute("aria-pressed", String(card.dataset.patchId === selected));
        });
        byId("RotateBtn").disabled = !selected || !canSelect();
        byId("FlipBtn").disabled = !selected || !canSelect();
        byId("FlipBtn").setAttribute("aria-pressed", String(flipped));
        panel.querySelectorAll("#patchworkNudgeActions button[data-dx]").forEach(button => {
            button.disabled = !(selected || bonus()) || !pivot || !isTurn() || !connected() || pending;
        });
        byId("AdvanceBtn").disabled = !can("advance");
        const opponent = view.players.find(player => player.player_id !== view.you);
        const gain = you && opponent ? Math.max(0, Math.min(view.track_end, opponent.time_position + 1) - you.time_position) : 0;
        byId("AdvanceGain").textContent = you ? `+🔘${gain}` : "";
        byId("PlacementActions").hidden = !def;
        byId("PlacementActions").classList.toggle("invalid", !!draft && !draft.valid);
        byId("ConfirmBuyBtn").disabled = !actionable || !draft?.valid || !affordable;
        byId("QuiltTitle").textContent = you ? "我的拼布" : `${playerName(view.players[0]?.player_id)} · 拼布`;
        let hint = "选一块布，再点击拼布预览。";
        if (view.game_over) hint = "最终得分见双方进度。";
        else if (!isTurn()) hint = you ? "对手完成行动后，进度会自动更新。" : "Spectating";
        else if (def) hint = draft ? draft.valid ? "✓ 可以摆放 · 可用箭头微调 · Confirm 后提交" : "× 重叠或越界 · 请用箭头、旋转或翻转调整" : "点击格子确定 ✚ 中心，再用箭头微调位置。";
        byId("SelectionHint").textContent = hint;
        if (def) {
            const shape = transformed(def);
            byId("Preview").innerHTML = shapeMarkup(shape.cells, def.id, true, shape.pivot);
            byId("PlacementStatus").textContent = pending ? "Submitting…" : bonus() ? "🟫 1×1 免费补丁" : !affordable ? `还差 🔘${def.cost_buttons - you.buttons}` : `${label(def.id)} · 支付 🔘${def.cost_buttons} / ⏳${def.cost_time} · 收入 +${def.income_buttons}`;
        } else byId("Preview").replaceChildren();
        renderBoard(byId("YourBoard"), you || view.players[0], !!you);
    }

    function render() {
        if (!view) return;
        byId("QuiltTitle").textContent = own() ? "我的拼布" : "观战拼布";
        renderMarket();
        renderPlayers();
        renderTrack();
        byId("Notice").hidden = !view.game_over && !view.pending_special_patch;
        byId("Notice").textContent = view.game_over ? `Game over · 获胜：${view.winner.map(playerName).join("、")} · ${view.players.map(player => `${playerName(player.player_id)} ${score(player)} 分`).join(" / ")}` : view.pending_special_patch ? `${playerName(view.pending_special_patch.player_id)} 获得 🟫 皮革补丁，摆放后继续前进。` : "";
        renderDraft();
        if (dialogs[2].open) renderInspectedQuilt();
    }

    function dispatch(action) {
        if (explaining || !can(action.type)) return;
        pending = true;
        hideTip();
        setError();
        renderDraft();
        sendAction(action);
    }

    function confirm() {
        const draft = placement();
        const def = definition();
        if (!draft?.valid || !def || own().buttons < def.cost_buttons) return;
        if (bonus()) dispatch({type: "place_bonus_patch", x: draft.origin[0], y: draft.origin[1]});
        else dispatch({type: "buy_patch", patch_id: selected, rotation, flip: flipped, x: draft.origin[0], y: draft.origin[1]});
    }

    function hideTip() {
        clearTimeout(tipTimer);
        tipTarget?.removeAttribute("aria-describedby");
        tipTarget = null;
        tooltip.hidden = true;
    }

    function showTip(target, autoHide = false) {
        if (!target || explaining || dialogs.some(dialog => dialog.open) || target.closest("button, summary, input, a, select")) return;
        hideTip();
        tipTarget = target;
        tooltip.textContent = target.dataset.patchworkTip;
        tooltip.hidden = false;
        target.setAttribute("aria-describedby", tooltip.id);
        const anchor = target.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - box.width - 12))}px`;
        tooltip.style.top = `${anchor.bottom + box.height + 8 < innerHeight ? anchor.bottom + 5 : Math.max(12, anchor.top - box.height - 5)}px`;
        if (autoHide) tipTimer = setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        document.body.classList.toggle("patchwork-explaining", enabled);
        byId("ExplainBtn").setAttribute("aria-pressed", String(enabled));
        hideTip();
    }

    function openDialog(dialog) {
        hideTip();
        focusBeforeDialog = document.activeElement;
        dialog.showModal();
        dialog.querySelector("button").focus({preventScroll: true});
    }

    function explain(target) {
        const explanation = explanations[target?.dataset.patchworkExplain];
        if (!explanation) return;
        setExplain(false);
        byId("ExplainTitle").textContent = explanation[0];
        byId("ExplainContent").textContent = explanation[1];
        openDialog(dialogs[1]);
    }

    function renderInspectedQuilt() {
        const player = view.players.find(entry => entry.player_id === inspectedPlayer);
        if (!player) { dialogs[2].close(); return; }
        byId("QuiltModalTitle").textContent = `${playerName(player.player_id)} · 拼布`;
        byId("QuiltModalMeta").textContent = `纽扣 🔘${player.buttons} · 收入 ↑🔘${player.button_income} · 空格 ⬜${player.empty_spaces} · 奖励 ⭐${player.has_special_tile ? view.special_tile_bonus : 0} · 得分 🏁${score(player)}`;
        renderBoard(byId("QuiltModalBoard"), player, false);
    }

    function captureActivity(previous, next) {
        if (!previous) return;
        for (const player of next.players) {
            const before = previous.players.find(entry => entry.player_id === player.player_id);
            if (!before) continue;
            if (player.placed_patches.length > before.placed_patches.length) {
                const latest = player.placed_patches.at(-1);
                activity = `${player.name || player.player_id} · ${latest.type === "leather" ? "放置 🟫 皮革补丁" : `购买${label(latest.patch_id)}`} · ⏳${player.time_position} · 🔘${player.buttons}`;
                return;
            }
            if (player.time_position !== before.time_position) {
                activity = `${player.name || player.player_id} · ⏩ ${before.time_position} → ${player.time_position} · 🔘${player.buttons}`;
                return;
            }
        }
    }

    function clearState() {
        view = null;
        roomKey = null;
        signature = "";
        pending = false;
        pointer = null;
        suppressClickUntil = 0;
        activity = "";
        inspectedPlayer = null;
        clearDraft();
        setExplain(false);
        setError();
        hideTip();
        dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
        document.body.classList.remove("patchwork-turn-active");
        ["Market", "Players", "Wallet", "Rewards", "Track", "YourBoard", "UpcomingMarket", "Activity", "Preview"].forEach(suffix => byId(suffix).replaceChildren());
        byId("PlacementActions").hidden = true;
        byId("Notice").hidden = true;
        byId("UpcomingDetails").open = false;
        byId("TimeDetails").open = matchMedia("(min-width: 901px)").matches;
    }

    window.clearPatchworkState = clearState;
    window.showPatchworkHeaderActions = show => {
        byId("HeaderActions").style.display = show ? "flex" : "none";
        if (!show) clearState();
    };
    window.renderPatchworkGameState = data => {
        const next = data?.view;
        if (!next) return;
        if (view && (roomKey !== data.room_id || view.you !== next.you)) clearState();
        const nextSignature = JSON.stringify([data.room_id, next.you, next.current_turn, next.game_over, next.pending_special_patch, next.patch_circle, next.players.map(player => [player.player_id, player.buttons, player.time_position, player.quilt_board])]);
        const changed = nextSignature !== signature;
        if (changed) {
            captureActivity(view, next);
            pending = false;
            clearDraft();
            hideTip();
            setError();
        }
        awaitingResync = false;
        signature = nextSignature;
        roomKey = data.room_id;
        view = next;
        if (changed) render();
        else renderDraft();
    };

    panel.addEventListener("click", event => {
        if (explaining || event.defaultPrevented || !view) return;
        const patch = event.target.closest("button[data-patch-id]");
        const cell = event.target.closest("#patchworkYourBoard button[data-column]");
        const player = event.target.closest("[data-player-id]");
        if (patch && canSelect()) {
            const next = patch.dataset.patchId;
            const toggleOff = selected === next;
            clearDraft();
            selected = toggleOff ? null : next;
            renderDraft();
        } else if (cell && isTurn() && connected() && !pending && (selected || bonus())) {
            const column = Number(cell.dataset.column);
            const row = Number(cell.dataset.row);
            if (bonus() && own().quilt_board[row][column] !== null) return;
            pivot = [column, row];
            renderDraft();
        } else if (player) {
            inspectedPlayer = player.dataset.playerId;
            renderInspectedQuilt();
            openDialog(dialogs[2]);
        } else if (!event.target.closest("button, summary, details, a, [data-patchwork-tip], .patchwork-placement-actions, .patchwork-board")) {
            clearDraft();
            renderDraft();
        }
    });
    byId("RotateBtn").addEventListener("click", () => {
        if (!selected || !canSelect()) return;
        rotation = (rotation + 270) % 360;
        renderDraft();
    });
    byId("FlipBtn").addEventListener("click", () => {
        if (!selected || !canSelect()) return;
        flipped = !flipped;
        rotation = (360 - rotation) % 360;
        renderDraft();
    });
    byId("NudgeActions").addEventListener("click", event => {
        const button = event.target.closest("button[data-dx]");
        if (explaining || !button || !(selected || bonus()) || !pivot || !isTurn() || !connected() || pending) return;
        pivot = [
            Math.max(0, Math.min(view.board_size - 1, pivot[0] + Number(button.dataset.dx))),
            Math.max(0, Math.min(view.board_size - 1, pivot[1] + Number(button.dataset.dy))),
        ];
        renderDraft();
    });
    byId("ConfirmBuyBtn").addEventListener("click", confirm);
    byId("AdvanceBtn").addEventListener("click", () => dispatch({type: "advance"}));
    byId("HelpContent").innerHTML = help;
    byId("HelpBtn").addEventListener("click", () => { setExplain(false); openDialog(dialogs[0]); });
    byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
    ["Help", "Explain", "Quilt"].forEach((suffix, index) => byId(`${suffix}Close`).addEventListener("click", () => dialogs[index].close()));
    dialogs.forEach(dialog => {
        dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus({preventScroll: true}); });
        dialog.addEventListener("click", event => {
            const rect = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
        });
    });

    const exempt = target => !!target.closest("#patchworkHelpBtn, #patchworkExplainBtn, .patchwork-dialog, #roomControlsToggleBtn, #roomControlsCollapseBtn");
    document.addEventListener("pointerdown", event => {
        if (!active() || exempt(event.target) || dialogs.some(dialog => dialog.open)) return;
        const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-patchwork-explain]");
        pointer = {id: event.pointerId, column: event.clientX, row: event.clientY, moved: false, explaining, target: event.target, explainTarget: hit && panel.contains(hit) ? hit : null, type: event.pointerType};
    }, true);
    document.addEventListener("pointermove", event => {
        if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.column, event.clientY - pointer.row) > 8) {
            pointer.moved = true;
            hideTip();
        }
    }, true);
    document.addEventListener("pointerup", event => {
        if (pointer?.id !== event.pointerId) return;
        const gesture = pointer;
        pointer = null;
        if (gesture.moved) { suppressClickUntil = performance.now() + 600; return; }
        if (gesture.explaining) {
            event.preventDefault();
            event.stopImmediatePropagation();
            suppressClickUntil = performance.now() + 600;
            explain(gesture.explainTarget);
        } else if (gesture.type !== "mouse") showTip(gesture.target.closest("[data-patchwork-tip]"), true);
    }, true);
    document.addEventListener("pointercancel", event => {
        if (pointer?.id === event.pointerId) { pointer = null; suppressClickUntil = performance.now() + 600; hideTip(); }
    }, true);
    document.addEventListener("click", event => {
        if (!active() || exempt(event.target)) return;
        if (explaining || performance.now() < suppressClickUntil) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (explaining && event.detail === 0) explain(event.target.closest("[data-patchwork-explain]"));
        }
    }, true);
    document.addEventListener("keydown", event => {
        if (!active() || dialogs.some(dialog => dialog.open)) return;
        if (event.key === "Escape") {
            hideTip();
            if (explaining) setExplain(false);
            else { clearDraft(); renderDraft(); }
        } else if (explaining && ["Enter", " "].includes(event.key) && !exempt(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            explain(event.target.closest("[data-patchwork-explain]"));
        }
    }, true);
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-patchwork-tip]")); });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse" && tipTarget && !tipTarget.contains(event.relatedTarget)) hideTip(); });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-patchwork-tip]"), true));
    panel.addEventListener("focusout", hideTip);
    document.addEventListener("scroll", () => { hideTip(); if (pointer) pointer.moved = true; }, true);
    window.addEventListener("resize", hideTip);

    function syncRoom(state) {
        if (view && (!state || state.game_type !== "patchwork" || state.status === "lobby" || state.room_id !== roomKey)) clearState();
    }

    function initialize() {
        byId("TimeDetails").open = matchMedia("(min-width: 901px)").matches;
        setExplain(false);
        socket.on("room:state", syncRoom);
        socket.on("system:error", data => {
            if (!active() || !view) return;
            pending = false;
            renderDraft();
            setError(typeof data === "string" ? data : data?.message || "Action failed. Please try again.");
        });
        socket.on("disconnect", () => {
            if (!view) return;
            awaitingResync = true;
            pending = false;
            clearDraft();
            hideTip();
            renderDraft();
        });
        socket.on("connect", () => { if (view) renderDraft(); });
        socket.on("system:info", data => { if (view && data?.room_id === roomKey && data?.player_id === view.you) renderDraft(); });
        socket.on("room:session_replaced", () => { if (view) { awaitingResync = true; clearDraft(); renderDraft(); } });
        if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "patchwork" && currentRoomState?.room_id === lastGameStatePayload.room_id) window.renderPatchworkGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, {once: true});
    else initialize();
})();
