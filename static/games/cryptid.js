(() => {
    "use strict";
    const panel = document.getElementById("cryptidPanel");
    const header = document.getElementById("cryptidHeaderActions");
    const helpButton = document.getElementById("cryptidHelpBtn");
    const explainButton = document.getElementById("cryptidExplainBtn");
    const dialog = document.getElementById("cryptidDialog");
    const dialogBody = document.getElementById("cryptidDialogBody");
    const dialogTitle = document.getElementById("cryptidDialogTitle");
    const dialogClose = document.getElementById("cryptidDialogClose");
    const playerColors = ["#b65740", "#397a9d", "#997134", "#7863a1", "#39765b"];
    const structureColors = {white: "#fffef2", green: "#4a8054", blue: "#427baf", black: "#303b39"};
    const W = 744, H = 674;
    const phaseNames = {initial_clues: "开局分享", turn: "探索", search_extra_disc: "补放圆片", compensate_cube: "补放方块", round_end: "本轮回顾", game_over: "探索结束"};
    const CRYPTID_EXPLAIN = {
        map: {
            zh: "点选六边形后，在该格附近的地图蒙版内选择行动，并用 Confirm／Cancel 确认或取消。亮圈保留所选位置，确认区始终位于地图内。拖动或缩放不会提交动作。熊(🐻)用虚线，美洲狮(🐾)用实线边界。结构物有独立的类型与颜色。",
            en: "Tap a hex, then pick an action in the map overlay near that cell and confirm or cancel it. The bright ring keeps your chosen spot and the confirm area always stays inside the map. Dragging or zooming never submits a move. Bears (🐻) use dashed borders and cougars (🐾) use solid ones, and structures have their own type and colour."
        },
        question: {
            zh: "询问(❓)：选择无排除(■)的格子和尚未回答该格的另一名玩家。可以询问不符合自己线索的位置。系统诚实给出可能(●)或排除(■)；得到排除后，你须另放一个方块。",
            en: "Question (❓): pick a cell with no exclusion (■) and another player who has not answered for that cell yet. You may ask about a cell that fails your own clue. The server answers honestly with possible (●) or excluded (■), and a negative answer obliges you to place a cube elsewhere."
        },
        search: {
            zh: "搜索(🔍)：只能搜索符合自己线索、无排除(■)的格子。先放可能(●)；若已有自己的圆片，先在别处补圆片。依席位核对，首个否定后停止并补方块；全部通过才获胜。",
            en: "Search (🔍): you may only search a cell that matches your own clue and carries no exclusion (■). Place a possible disc (●) first, and if your disc is already there you top it up somewhere else. Checks run in seat order and stop at the first refusal, and you win only if everyone passes."
        },
        place: {
            zh: "排除(■)必须不符合你的线索，可能(●)必须符合。标记不能重复；有任何方块的格子都不能再互动。当前阶段只允许所需标记的合法新位置。",
            en: "An exclusion (■) must contradict your clue and a possible disc (●) must match it. You can never repeat your own marker, and any cell holding a cube is closed to everyone. The current phase only allows legal new spots for the marker it asks for."
        },
        confirm: {
            zh: "Confirm 提交蒙版内的当前选择。请先选合法格子；询问(❓)还需选一名尚未回答的对手。等待其他人、回顾未结束或发送中时不可提交。",
            en: "Confirm submits the current choice in the overlay. Select a legal cell first, and a question (❓) also needs an opponent who has not answered yet. You cannot submit while waiting for others, during the round review, or while a move is in flight."
        },
        cancel_selection: {
            zh: "Cancel 关闭选格蒙版，取消尚未提交的选择；点击蒙版周围空白或按 Esc 也可以。不会撤销已经提交的动作，补放圆片(●)／方块(■)的义务仍需完成。",
            en: "Cancel closes the cell overlay and drops the unsubmitted choice, and tapping the empty area around the overlay or pressing Esc does the same. It never undoes a submitted move, and any outstanding disc (●) or cube (■) you owe is still due."
        },
        next: {
            zh: "每圈结束暂停回顾。每人分别点击 Next Round，全员确认才继续。机器人只确认自己，断线真人不会自动跳过。",
            en: "Each lap ends with a review pause. Every player presses Next Round separately and play resumes only once all of them confirm. Bots confirm for themselves only, and a disconnected human is never skipped automatically."
        },
        notes: {
            zh: "笔记(📝)仅你可见：手动标记候选／排除格，或勾掉你认为不成立的对手线索。Save 保存到个人笔记，Close／Esc 放弃未保存编辑。不会替你自动推理。",
            en: "Notes (📝) are private to you. Mark cells as candidate or excluded by hand, or tick off opponent clues you think are false. Save stores them on your personal notepad and Close or Esc discards unsaved edits. It never reasons for you."
        },
        clue: {
            zh: "Your clue(🔒) 从右侧打开你的秘密线索，Close／Esc 收起。开启 Highlight on map 后收起侧栏，回到地图查看高亮。距离包括目标本身，within 2 表示 0、1、2 格。",
            en: "Your clue (🔒) opens your secret clue from the right, and Close or Esc puts it away. Turning on Highlight on map collapses the panel so you can see the highlight on the map. Distances include the target itself, so within 2 means 0, 1 or 2 hexes."
        },
        highlight: {
            zh: "Highlight 用金色描边与勾号(✓)标出符合你自己线索的格子，其余格子的地形淡化；公开标记仍然保留。高亮不代表符合别人线索，也不排除已出现方块的位置。地图工具栏可随时开启或关闭。",
            en: "Highlight outlines the cells matching your own clue in gold with a check (✓) and fades the terrain everywhere else, while public markers stay visible. A highlight says nothing about other players' clues and does not skip cells that already hold a cube. The map toolbar toggles it at any time."
        },
        hint: {
            zh: "提示(💡)需要投票：三人全部同意；四或五人至少人数减一同意。每局最多公开一次未使用的线索类别；没有可用类别时，在投票通过后说明。开局未完成或已揭示时不可投票。",
            en: "A hint (💡) needs a vote: all three players in a three player game, or at least one less than the full table otherwise. It reveals one unused clue category at most once per game, and if none is left the vote simply says so. Voting is closed before setup finishes and after the solution is revealed."
        },
        zoom: {
            zh: "使用 +／− 缩放，Fit 查看整张地图。地图区域内拖动平移，手机支持双指缩放；区域外正常滚动页面。",
            en: "Use + and − to zoom and Fit to frame the whole map. Drag inside the map area to pan and pinch to zoom on a phone, while dragging outside the area scrolls the page normally."
        },
        legend: {
            zh: "可能(●)只符合放置者的线索，排除(■)则让整格停止互动。玩家用颜色和座位编号区分；结构物的颜色与玩家归属无关。",
            en: "A possible disc (●) only matches the clue of the player who placed it, while an exclusion (■) shuts the whole cell down. Players are told apart by colour and seat number, and structure colours have nothing to do with player ownership."
        },
        dialog_close: {
            zh: "关闭当前对话框并回到地图。",
            en: "Close the current dialog and return to the map."
        }
    };
    const explainText = key => CRYPTID_EXPLAIN[key]?.[window.obgHelpLang?.() === "en" ? "en" : "zh"] || "";
    let view = null, signature = null, selected = null, target = "", mode = "question";
    let pending = false, pendingTimer = null, suppressed = null;
    let zoom = 1, center = {x: W / 2, y: H / 2}, showClue = false;
    let notesDraft = null, notebookPlayer = "", notebookCell = null, returnFocus = null, returnFocusAction = null;
    let narrowLayout = window.innerWidth < 600;
    const initialZoom = () => window.innerWidth < 360 ? 2.6 : window.innerWidth < 600 ? 2.2 : 1;
    const pointers = new Map();
    let gesture = null, blockClickUntil = 0;
    const tip = document.createElement("div");
    tip.className = "cryptid-tip"; tip.hidden = true; tip.setAttribute("role", "status");
    document.body.append(tip);
    let tipTimer = null;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const name = pid => view?.players.find(p => p.player_id === pid)?.name || "—";
    const color = pid => playerColors[view?.players.find(p => p.player_id === pid)?.seat ?? 0];
    const available = kind => !pending && !!view?.legal_actions.includes(kind);
    const btn = (text, action, explain = action, disabled = false, extra = "") => `<button type="button" data-cryptid-action="${action}" data-cryptid-explain="${explain}" ${disabled ? "disabled" : ""} ${extra}>${text}</button>`;

    function hideTip() { tip.hidden = true; window.clearTimeout(tipTimer); }
    function showTip(text, anchor, touch = false) {
        if (!text) return;
        window.clearTimeout(tipTimer);
        tip.textContent = text; tip.hidden = false;
        const rect = anchor.getBoundingClientRect(), bounds = tip.getBoundingClientRect();
        const width = window.innerWidth, height = window.innerHeight;
        const x = touch ? (width - bounds.width) / 2 : rect.left;
        const y = touch ? (rect.top < height / 2 ? height - bounds.height - 12 : 12) : (rect.top > bounds.height + 16 ? rect.top - bounds.height - 8 : rect.bottom + 8);
        tip.style.left = `${Math.max(12, Math.min(width - bounds.width - 12, x))}px`;
        tip.style.top = `${Math.max(12, Math.min(height - bounds.height - 12, y))}px`;
        if (touch) tipTimer = window.setTimeout(hideTip, 3000);
    }

    function cellDescription(cell) {
        const terrain = view.terrain_defs[cell.terrain];
        const parts = [`${cell.id} · ${terrain.name}(${terrain.icon})`];
        if (cell.animal) { const a = view.animal_defs[cell.animal]; parts.push(`${a.name}(${a.icon})领地`); }
        if (cell.structure) { const s = view.structure_defs[cell.structure.type]; parts.push(`${view.color_names[cell.structure.color]}${s.name}(${s.icon})`); }
        const markers = view.markers[cell.id];
        if (markers.cube) parts.push(`${name(markers.cube)}：排除(■)`);
        for (const pid of markers.discs) parts.push(`${name(pid)}：可能(●)`);
        if (view.notes?.cells[cell.id]) parts.push(`个人笔记：${view.notes.cells[cell.id] === "candidate" ? "候选" : "排除"}`);
        return parts.join("；");
    }

    function hexPoints(radius) {
        return Array.from({length: 6}, (_, i) => `${Math.cos(i * Math.PI / 3) * radius},${Math.sin(i * Math.PI / 3) * radius}`).join(" ");
    }

    function mapHTML() {
        return `<svg class="cryptid-map ${showClue ? "is-highlighting" : ""}" viewBox="0 0 ${W} ${H}" aria-label="Cryptid hex map" role="group" ${selected ? "inert" : ""}>
            ${Array.from({length: 12}, (_, col) => `<text class="cryptid-cell-coord" x="${48 + col * 57}" y="8">${String.fromCharCode(65 + col)}</text>`).join("")}
            ${Array.from({length: 9}, (_, row) => `<text class="cryptid-cell-coord" x="6" y="${46 + row * Math.sqrt(3) * 38}">${row + 1}</text>`).join("")}
            ${view.board.map(cell => {
                const x = 48 + cell.col * 57, y = 42 + cell.row * Math.sqrt(3) * 38 + (cell.col % 2) * Math.sqrt(3) * 19;
                const marker = view.markers[cell.id];
                const terrain = view.terrain_defs[cell.terrain];
                const extra = [];
                if (cell.animal) extra.push(`<text class="cryptid-cell-extra" x="${cell.structure ? -12 : 0}" y="9">${view.animal_defs[cell.animal].icon}</text>`);
                if (cell.structure) {
                    const sx = cell.animal ? 13 : 0;
                    extra.push(`<rect x="${sx - 10}" y="-5" width="20" height="19" rx="4" fill="${structureColors[cell.structure.color]}" stroke="#26372f" stroke-width="1"/><text class="cryptid-cell-extra" x="${sx}" y="9">${view.structure_defs[cell.structure.type].icon}</text>`);
                }
                const owners = [...marker.discs, ...(marker.cube ? [marker.cube] : [])];
                const markers = owners.map((pid, i) => {
                    const mx = (i - (owners.length - 1) / 2) * 9;
                    const number = (view.players.find(p => p.player_id === pid)?.seat ?? 0) + 1;
                    return `<g transform="translate(${mx},22)">${pid === marker.cube ? `<rect x="-4" y="-4" width="8" height="8" rx="1" fill="${color(pid)}" stroke="#fff"/>` : `<circle r="4" fill="${color(pid)}" stroke="#fff"/>`}<text class="cryptid-marker-label" y="3">${number}</text></g>`;
                }).join("");
                const note = view.notes?.cells[cell.id];
                return `<g class="cryptid-cell ${selected === cell.id ? "is-selected" : ""} ${marker.cube ? "is-blocked" : ""} ${showClue && view.my_matches.includes(cell.id) ? "is-possible" : ""}" transform="translate(${x},${y})" data-cell="${cell.id}" data-cryptid-explain="map" data-cryptid-tip="${esc(cellDescription(cell))}" role="button" tabindex="0" aria-label="${esc(cellDescription(cell))}" aria-pressed="${selected === cell.id}">
                    <g class="cryptid-cell-landscape"><polygon class="cryptid-cell-shape" points="${hexPoints(38)}" fill="${terrain.color}"/>
                    ${cell.animal ? `<polygon class="cryptid-territory is-${cell.animal}" points="${hexPoints(34)}"/>` : ""}
                    <text class="cryptid-cell-icon" y="-12">${terrain.icon}</text>${extra.join("")}</g>
                    ${showClue && view.my_matches.includes(cell.id) ? `<polygon class="cryptid-clue-outline" points="${hexPoints(36)}"/><polygon class="cryptid-clue-ring" points="${hexPoints(36)}"/><g class="cryptid-clue-check" aria-hidden="true" transform="translate(22,-15)"><circle r="8"/><path d="M-4 0 -1 3 4-3"/></g>` : ""}
                    ${markers}
                    ${note ? `<circle cx="27" cy="0" r="5" fill="${note === "candidate" ? "#fff28a" : "#fbf9f0"}" stroke="#26372f" stroke-width="1.5"/>` : ""}
                    ${selected === cell.id ? `<polygon class="cryptid-selected-ring" points="${hexPoints(38)}"/>` : ""}
                </g>`;
            }).join("")}</svg>`;
    }

    function actionCandidate() {
        if (!view || !selected) return null;
        for (const kind of ["place_initial_cube", "place_extra_disc", "place_compensation_cube"]) {
            if (available(kind) && view.placement_cells.includes(selected)) return {type: kind, cell_id: selected};
        }
        if (mode === "search" && available("search") && view.search_cells.includes(selected)) return {type: "search", cell_id: selected};
        if (mode === "question" && available("question") && target && target !== view.you &&
            view.players.some(p => p.player_id === target) && !view.markers[selected].cube && !view.markers[selected].discs.includes(target)) {
            return {type: "question", cell_id: selected, target_player_id: target};
        }
        return null;
    }

    function stepText() {
        if (pending) return "Sending…";
        if (view.game_over) return `${name(view.winner[0])} 找到了神秘生物。`;
        if (view.phase === "round_end") return "查看本轮结果，然后每人确认继续。";
        if (view.current_turn !== view.you) return `Waiting for ${name(view.current_turn)}`;
        if (view.phase === "initial_clues") return `开局第 ${view.initial_pass} 圈：选一个不符合线索的格子放 ■。`;
        if (view.phase === "compensate_cube") return "另选一个不符合自己线索的格子，补放排除(■)。";
        if (view.phase === "search_extra_disc") return `搜索 ${view.pending_search.cell_id} 前，另选一格补放可能(●)。`;
        return mode === "search" ? "选一个符合自己线索的格子进行搜索。" : "点选格子，再选择要询问的玩家。";
    }

    function selectionHTML() {
        const cell = view.board.find(item => item.id === selected);
        if (!cell) return "";
        const t = view.terrain_defs[cell.terrain];
        const details = cellDescription(cell).split("；").slice(1);
        const question = available("question");
        const options = view.players.filter(p => p.player_id !== view.you);
        const canConfirm = !view.game_over && view.phase !== "round_end";
        let hint = view.current_turn === view.you && view.phase === "turn" ? "" : stepText();
        if (canConfirm && !pending && view.current_turn === view.you) {
            if (view.markers[selected].cube) hint = "此格已有排除(■)，不能再进行操作。";
            else if (view.phase === "turn" && mode === "search" && !view.search_cells.includes(selected)) hint = "此格不符合你的线索，不能搜索。";
            else if (view.phase !== "turn" && !view.placement_cells.includes(selected)) hint = "此格不符合当前标记的放置条件。";
        }
        return `<div class="cryptid-selection-overlay"><section class="cryptid-selection-card" role="region" aria-labelledby="cryptidSelectionTitle" tabindex="-1">
            <h3 id="cryptidSelectionTitle">${cell.id} · ${t.name}(${t.icon})</h3>
            <div class="cryptid-selection-body"><div class="cryptid-detail-list">${details.map(part => `<span>${esc(part)}</span>`).join("") || "尚无公开标记"}</div>
                ${view.phase === "turn" ? `<div class="cryptid-mode-buttons">${btn("❓ 询问", "question", "question", !question, `class="${mode === "question" ? "is-active" : ""}" aria-pressed="${mode === "question"}"`)}${btn("🔍 搜索", "search", "search", !available("search"), `class="${mode === "search" ? "is-active" : ""}" aria-pressed="${mode === "search"}"`)}</div>` : ""}
                ${view.phase === "turn" && mode === "question" ? `<label class="cryptid-target-label" data-cryptid-explain="question"><span>Ask</span><select id="cryptidTarget" ${!question ? "disabled" : ""}><option value="">Select player</option>${options.map(p => `<option value="${esc(p.player_id)}" ${target === p.player_id ? "selected" : ""} ${view.markers[selected].cube || view.markers[selected].discs.includes(p.player_id) ? "disabled" : ""}>${p.seat + 1} · ${esc(p.name)}</option>`).join("")}</select></label>` : ""}
                ${hint ? `<p class="cryptid-muted" aria-live="polite">${esc(hint)}</p>` : ""}
            </div><div class="cryptid-actions">${canConfirm ? btn("Confirm", "confirm", "confirm", !actionCandidate(), 'class="cryptid-primary"') : ""}${btn("Cancel", "cancel_selection")}</div>
        </section></div>`;
    }

    function actionHTML() {
        if (view.game_over) return "";
        const phaseExplanation = view.phase === "turn" ? mode : view.phase === "round_end" ? "next" : "place";
        return `<section class="cryptid-map-status"><h3 data-cryptid-explain="${phaseExplanation}">${phaseNames[view.phase]}</h3><p class="cryptid-muted" aria-live="polite">${esc(stepText())}</p>
            ${view.phase === "round_end" ? `<div class="cryptid-actions">${btn(view.next_ready.includes(view.you) ? "Ready ✓" : "Next Round", "next", "next", !available("next_round"), 'class="cryptid-primary"')}</div><p class="cryptid-muted">Waiting: ${esc(view.players.filter(p => !view.next_ready.includes(p.player_id)).map(p => p.name).join(", ")) || "—"}</p>` : ""}
        </section>`;
    }

    function highlightHTML() {
        if (!showClue) return "";
        return `<div class="cryptid-highlight-status" role="status" data-cryptid-explain="highlight" data-cryptid-tip="${esc(explainText("highlight"))}"><span class="cryptid-highlight-key" aria-hidden="true">✓</span><span>符合你的线索 <strong>${view.my_matches.length} / ${view.board.length}</strong></span><span class="cryptid-highlight-muted">其余地形淡化</span></div>`;
    }

    function resultsHTML() {
        if (!view.last_action) return "";
        const a = view.last_action;
        return `<section class="cryptid-box"><h3>${a.type === "search" ? "🔍" : "❓"} ${a.cell_id} · ${esc(name(a.actor))}</h3><div class="cryptid-results">${a.results.map(r => `<div class="cryptid-result"><span class="cryptid-dot" style="background:${color(r.player_id)}"></span>${esc(name(r.player_id))} · ${r.positive ? "可能(●)" : "排除(■)"}${r.already_present ? " · 已有圆片" : ""}</div>`).join("")}</div></section>`;
    }

    function render() {
        if (!view) return;
        const focused = document.activeElement.closest?.(".cryptid-selection-card") ? {id: document.activeElement.id, action: document.activeElement.dataset.cryptidAction} : null;
        const scrollTop = panel.querySelector(".cryptid-selection-body")?.scrollTop || 0;
        resetGesture(); hideTip();
        panel.innerHTML = `<div class="cryptid-shell"><div class="cryptid-top"><span class="cryptid-badge">${view.advanced ? "Advanced" : "Normal"} · ${view.round ? `Round ${view.round}` : "Setup"}</span></div>
            <div class="cryptid-players">${view.players.map(p => `<div class="cryptid-player ${p.player_id === view.current_turn ? "is-current" : ""}"><strong><span class="cryptid-dot" style="background:${color(p.player_id)}"></span>${p.seat + 1} · ${esc(p.name)}</strong><small>${p.player_id === view.you ? "You" : p.is_bot ? "Bot" : "Player"}${p.player_id === view.current_turn ? " · Acting" : view.next_ready.includes(p.player_id) ? " · Ready ✓" : ""}</small></div>`).join("")}</div>
            <div class="cryptid-layout"><div class="cryptid-map-area"><div class="cryptid-map-frame"><div class="cryptid-map-tools"><div class="cryptid-zoom-tools">${btn("−", "out", "zoom")}${btn("+", "in", "zoom")}${btn("Fit", "fit", "zoom")}<span class="cryptid-zoom">${Math.round(zoom * 100)}%</span>${btn(`${showClue ? "✓ " : ""}Highlight`, "highlight", "highlight", !view.my_clue, `class="cryptid-highlight-toggle" aria-pressed="${showClue}"`)}</div><div class="cryptid-dock-tools">${btn("🔒 Your clue", "clue", "clue", !view.my_clue, 'aria-haspopup="dialog" aria-controls="cryptidDialog"')}${btn("📝 Notes", "notes", "notes", !view.notes, 'aria-haspopup="dialog" aria-controls="cryptidDialog"')}</div></div>${actionHTML()}${highlightHTML()}<div class="cryptid-map-viewport">${mapHTML()}${selectionHTML()}</div></div>
                <div class="cryptid-legend">${Object.values(view.terrain_defs).map(t => `<button type="button" data-cryptid-explain data-cryptid-tip="${esc(`${t.name}(${t.icon})：五种地形之一。`)}">${t.icon} ${t.name}</button>`).join("")}<button type="button" data-cryptid-explain="legend" data-cryptid-tip="${esc(explainText("legend"))}">● / ■</button><button type="button" data-cryptid-explain data-cryptid-tip="熊(🐻)用虚线边界，美洲狮(🐾)用实线边界；领地叠加在地形上。">🐻 / 🐾</button><button type="button" data-cryptid-explain data-cryptid-tip="立石(🗿)与废弃小屋(🏚️)；色框表示结构物的白、绿、蓝、黑颜色，与玩家颜色无关。">🗿 / 🏚️</button></div>
                ${view.phase === "round_end" ? `<section class="cryptid-box cryptid-review"><h3>Round review</h3><ul class="cryptid-history">${view.last_round.map(line => `<li>${esc(line)}</li>`).join("")}</ul></section>` : ""}
                ${view.game_over ? `<section class="cryptid-box cryptid-review"><h3>🏆 ${esc(name(view.winner[0]))} · ${view.solution}</h3><div class="cryptid-results">${view.players.map(p => `<div class="cryptid-result"><strong>${esc(p.name)}</strong>：${esc(view.revealed_clues[p.player_id].description)}</div>`).join("")}</div></section>` : ""}
            </div><div class="cryptid-sidebar">${resultsHTML()}
                ${!view.game_over || view.hint ? `<section class="cryptid-box" data-cryptid-explain="hint"><h3 data-cryptid-tip="提示(💡)：表决通过后公开一个额外线索类别，每局最多一次。">💡 Hint</h3>${view.hint ? `<p class="cryptid-muted">${esc(view.hint)}</p>` : `<p class="cryptid-muted">${Object.values(view.hint_votes).filter(Boolean).length} / ${view.players.length === 3 ? 3 : view.players.length - 1} votes</p><div class="cryptid-actions">${btn("Agree", "hint_yes", "hint", !available("vote_hint"))}${btn("Decline", "hint_no", "hint", !available("vote_hint"))}</div>`}</section>` : ""}
                <details class="cryptid-box"><summary>Public log</summary><ul class="cryptid-history">${view.log.slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ul></details>
            </div></div><p class="cryptid-footer">${esc(view.map_source)} · ${view.catalog.length} clue types</p></div>`;
        updateMap(); updateDockButtons();
        const selectionBody = panel.querySelector(".cryptid-selection-body");
        if (selectionBody) selectionBody.scrollTop = scrollTop;
        if (focused && !dialog.open) {
            const control = focused.id ? document.getElementById(focused.id) : panel.querySelector(`.cryptid-selection-card [data-cryptid-action="${focused.action}"]`);
            control?.focus({preventScroll: true});
        }
    }

    function selectCell(cellId) {
        selected = cellId; target = ""; render();
        panel.querySelector(".cryptid-selection-card")?.focus({preventScroll: true});
    }

    function cancelSelection() {
        const previous = selected;
        selected = null; target = ""; render();
        panel.querySelector(`[data-cell="${previous}"]`)?.focus({preventScroll: true});
        hideTip();
    }

    function updateMap() {
        const svg = panel.querySelector(".cryptid-map");
        if (!svg) return;
        const width = W / zoom, height = H / zoom;
        center.x = Math.max(width / 2, Math.min(W - width / 2, center.x));
        center.y = Math.max(height / 2, Math.min(H - height / 2, center.y));
        svg.setAttribute("viewBox", `${center.x - width / 2} ${center.y - height / 2} ${width} ${height}`);
        svg.classList.toggle("is-compact", svg.clientWidth / W * zoom < 0.95);
        const label = panel.querySelector(".cryptid-zoom");
        if (label) label.textContent = `${Math.round(zoom * 100)}%`;
        positionSelection();
    }

    function positionSelection() {
        if (!selected) return;
        const viewport = panel.querySelector(".cryptid-map-viewport");
        const overlay = panel.querySelector(".cryptid-selection-overlay");
        const card = panel.querySelector(".cryptid-selection-card");
        const cell = panel.querySelector(`[data-cell="${selected}"]`);
        if (!viewport || !overlay || !card || !cell) return;
        const bounds = viewport.getBoundingClientRect(), tile = cell.getBoundingClientRect();
        const margin = 8, gap = 12;
        const screenTop = window.visualViewport?.offsetTop || 0;
        const screenBottom = screenTop + (window.visualViewport?.height || window.innerHeight);
        const top = Math.max(margin, screenTop - bounds.top + margin);
        const bottom = Math.min(bounds.height - margin, screenBottom - bounds.top - margin);
        // Keep the actions in the visible part of the board, including after a page scroll.
        const minTop = Math.min(top, bounds.height - 140);
        const maxBottom = Math.max(bottom, minTop + 132);
        card.style.maxHeight = `${maxBottom - minTop}px`;
        const size = card.getBoundingClientRect();
        const x = (tile.left + tile.right) / 2 - bounds.left;
        const y = (tile.top + tile.bottom) / 2 - bounds.top;
        const below = tile.bottom - bounds.top + gap;
        const above = tile.top - bounds.top - gap - size.height;
        const preferred = below + size.height <= maxBottom ? below : above >= minTop ? above : y < (minTop + maxBottom) / 2 ? maxBottom - size.height : minTop;
        card.style.left = `${Math.max(margin, Math.min(bounds.width - size.width - margin, x - size.width / 2))}px`;
        card.style.top = `${Math.max(minTop, Math.min(maxBottom - size.height, preferred))}px`;
        overlay.style.setProperty("--cryptid-selection-x", `${x}px`);
        overlay.style.setProperty("--cryptid-selection-y", `${y}px`);
        overlay.style.setProperty("--cryptid-selection-radius", `${Math.max(20, tile.height / 2 + 5)}px`);
    }

    function setZoom(value) { zoom = Math.max(1, Math.min(3.4, value)); updateMap(); hideTip(); }
    let cryptidHelpWidget = null;
    let cryptidExplainWidget = null;
    function submit(action) {
        if (!action || !available(action.type)) return;
        if (action.cell_id) { selected = null; target = ""; }
        pending = true; hideTip(); render(); sendAction(action);
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; render(); }, 6000);
    }
    function openDialog(title, html, kind = "reference") {
        hideTip(); returnFocus = document.activeElement;
        returnFocusAction = returnFocus?.dataset.cryptidAction;
        dialogTitle.textContent = title; dialogBody.innerHTML = html;
        dialog.classList.toggle("is-notebook", kind === "notes"); dialog.dataset.kind = kind;
        dialog.classList.toggle("is-docked", ["notes", "clue"].includes(kind));
        if (!dialog.open) dialog.showModal();
        updateDockButtons();
    }

    function updateDockButtons() {
        for (const kind of ["notes", "clue"]) panel.querySelector(`[data-cryptid-action="${kind}"]`)?.setAttribute("aria-expanded", String(dialog.open && dialog.dataset.kind === kind));
    }

    function openClue() {
        if (!view.my_clue) return;
        openDialog("🔒 Your clue", `<p class="cryptid-muted">Private</p><section class="cryptid-box cryptid-clue"><p>${esc(view.my_clue.description)}</p><label class="cryptid-inline-label"><input id="cryptidShowClue" type="checkbox" ${showClue ? "checked" : ""}/><span>Highlight on map</span></label></section>`, "clue");
    }

    const CRYPTID_CLUE_BASE = {
        zh: "<p>普通模式收录 23 条线索，覆盖两种地形之一、1 格内某地形、1 格内任意动物、2 格内某类结构物、2 格内某种动物，以及 3 格内某颜色结构物。</p><p>进阶模式再加入黑色结构物与完整条件的否定，共 48 条。例如不满足位于森林或水域，意思是既非森林也非水域。不在 2 格内则表示距离大于 2。建筑类型线索忽略颜色，颜色线索忽略类型。</p>",
        en: "<p>Normal mode holds 23 clues covering one of two terrain types, a terrain within 1, any animal within 1, a structure type within 2, an animal within 2, and a structure colour within 3.</p><p>Advanced mode adds black structures and full negations for a total of 48. Not satisfied by forest or water means the cell is neither forest nor water, and not within 2 means the distance is greater than 2. Structure type clues ignore colour and colour clues ignore type.</p>"
    };

    const CRYPTID_HELP_CONFIG = {
        gameId: "cryptid",
        title: { zh: "诡影寻踪 · Cryptid", en: "Cryptid" },
        basic: {
            win: {
                zh: "地图上只有一个格子同时符合所有人的线索，先成功搜索(🔍)该格的玩家获胜，光在笔记(📝)里推断出来并不算赢。",
                en: "Exactly one cell on the map satisfies every player's clue at once, and the first player to search (🔍) that cell wins. Working it out in your notes (📝) alone does not count."
            },
            turn: {
                zh: "轮到你时二选一，向一名对手询问(❓)某个格子，或者搜索(🔍)一个符合你自己线索的格子，两种行动都会在地图上留下可能(●)或排除(■)标记。",
                en: "On your turn you pick one of two actions, either question (❓) an opponent about a cell or search (🔍) a cell matching your own clue, and both leave a possible (●) or excluded (■) marker on the map."
            },
            key: {
                zh: "你的线索只有你自己知道，所以真正的功夫在于用别人被迫放下的标记反推出他们的线索，并锁定那个唯一解。",
                en: "Only you know your own clue, so the real work is reading the markers your opponents are forced to place, reconstructing their clues, and pinning down the single cell that fits them all."
            }
        },
        sections: [
            {
                id: "setup",
                label: { zh: "开局与标记", en: "Setup and markers" },
                html: {
                    zh: "<p>按照起始席位，每人轮流放一个排除(■)，一共两圈，每人两个。可能(●)表示符合放置者自己的线索，排除(■)表示不符合。</p><p>每格可以有不同玩家的圆片，但至多一个方块。方块出现之后就不能再对该格进行任何操作。自己的标记不可重复，标记也不会移走。</p>",
                    en: "<p>Following the starting seating, players take turns placing one exclusion (■) each, two full laps so everyone places two. A possible disc (●) means the cell matches the placer's own clue, and an exclusion (■) means it does not.</p><p>A cell may carry discs from several different players but at most one cube. Once a cube appears the cell is closed to every further action. You can never repeat your own marker, and markers are never removed.</p>"
                }
            },
            {
                id: "terrain",
                label: { zh: "地形与距离", en: "Terrain and distance" },
                html: {
                    zh: "<p>森林(🌲)、沙漠(🏜️)、水域(🌊)、山地(⛰️)与沼泽(🌿)是五种地形。熊(🐻)与美洲狮(🐾)是叠加在地形之上的领地。立石(🗿)与废弃小屋(🏚️)各自有不同的颜色。</p><p>距离按六边形相邻格计算，包含目标自身的 0 格，地形不会阻挡距离。</p>",
                    en: "<p>Forest (🌲), desert (🏜️), water (🌊), mountain (⛰️) and swamp (🌿) are the five terrain types. Bears (🐻) and cougars (🐾) are territories layered on top of the terrain. Standing stones (🗿) and abandoned shacks (🏚️) each come in several colours.</p><p>Distance is counted in adjacent hexes and includes the target itself at 0, and terrain never blocks distance.</p>"
                }
            },
            {
                id: "turn",
                label: { zh: "每回合二选一", en: "Your two actions" },
                html: {
                    zh: "<p>询问(❓)要选一个没有排除(■)的格子，再选一名尚未回答过该格的对手。你可以问一个不符合自己线索的位置，系统会诚实回答，得到否定后你必须另放一个方块。</p><p>搜索(🔍)只能选符合自己线索且没有排除(■)的格子。你先放一个可能(●)，如果那里已经有自己的圆片，就先在别处补一个。系统按席位逐一核对，遇到第一个否定就停下并让你补方块，全部通过才算获胜。</p><p>搜索过程中已有对方圆片就跳过那个人。补圆片不会改变原来的搜索格，遇到第一个方块立刻停止，后面的玩家不会泄露结果。搜索失败不会出局，补完方块后照常轮转。</p>",
                    en: "<p>A question (❓) needs a cell with no exclusion (■) plus an opponent who has not answered for that cell yet. You may ask about a spot that fails your own clue, the server answers honestly, and a negative answer obliges you to place a cube elsewhere.</p><p>A search (🔍) may only target a cell that matches your own clue and carries no exclusion (■). You place a possible disc (●) first, and if your disc already sits there you top it up somewhere else. The server checks players in seat order, stops at the first refusal and makes you place a cube, and you win only when everybody passes.</p><p>Players who already have a disc on the searched cell are skipped. Topping up a disc never changes the original search cell, the check halts at the first cube, and later players learn nothing. Failing a search does not knock you out, and play continues normally once you place your cube.</p>"
                }
            },
            {
                id: "clues",
                label: { zh: "线索目录", en: "Clue catalogue" },
                html: { zh: CRYPTID_CLUE_BASE.zh, en: CRYPTID_CLUE_BASE.en }
            },
            {
                id: "tools",
                label: { zh: "提示与笔记", en: "Hints and notes" },
                html: {
                    zh: "<p>提示(💡)需要投票通过，三人局要全员同意，四人或五人局至少要人数减一同意。每局最多公开一个尚未使用的线索类别，没有可用类别时会在投票通过后说明。开局未完成或答案已揭示时不能投票。</p><p>笔记(📝)只有你自己看得到，可以手动标记候选格与排除格，也可以勾掉你认为不成立的对手线索，按 Save 保存。Your clue(🔒) 用来查看自己的秘密线索，Highlight 用金色描边标出符合你线索的格子。</p><p>每圈结束会暂停回顾，每人分别点 Next Round，全员确认之后才继续。</p>",
                    en: "<p>A hint (💡) needs a vote, unanimous in a three player game and at least one less than the full table in four or five player games. It reveals at most one unused clue category per game, and says so when none is left. Voting is closed before setup finishes and after the solution is revealed.</p><p>Notes (📝) are private, letting you mark candidate and excluded cells by hand or tick off opponent clues you believe are false, then Save. Your clue (🔒) shows your secret clue, and Highlight outlines the cells matching it in gold.</p><p>Each lap ends with a review pause where everyone presses Next Round separately, and play resumes only once all of them confirm.</p>"
                }
            },
            {
                id: "online",
                label: { zh: "线上适配", en: "Online notes" },
                html: {
                    zh: "<p>强制回答由服务器诚实计算。只有当所有合法新落点都已耗尽时，才会免除对应的额外圆片或补偿方块，并公开记录，这是避免卡局的线上约定。</p><p>地图地形依据官方辅助站转录，题目独立生成并验证唯一解，界面使用原创图形。普通模式有六个结构物，进阶模式有八个。本实现没有双人规则，也没有 Urban Legends 模式。</p>",
                    en: "<p>Forced answers are computed honestly by the server. Only when every legal new placement is exhausted does it waive the matching extra disc or compensating cube, and that waiver is logged publicly as an online convention that keeps games from stalling.</p><p>Map terrain is transcribed from the official helper site, puzzles are generated independently and verified to have a unique solution, and the interface art is original. Normal mode uses six structures and advanced mode uses eight. There is no two player rule and no Urban Legends mode here.</p>"
                }
            },
            {
                id: "controls",
                label: { zh: "地图操作", en: "Map controls" },
                html: {
                    zh: "<p>用 +／− 缩放，按 Fit 查看整张地图。在地图区域内拖动可以平移，手机支持双指缩放，区域之外则正常滚动页面。</p><p>点选六边形后会在附近弹出蒙版，在蒙版里选行动并用 Confirm 或 Cancel 确认取消。点蒙版周围的空白或按 Esc 也能取消未提交的选择。</p><p>图标可以悬停查看说明，手机轻点会显示三秒提示。</p>",
                    en: "<p>Use + and − to zoom and Fit to frame the whole map. Dragging inside the map area pans it, phones support pinch zoom, and dragging outside the area scrolls the page normally.</p><p>Tapping a hex opens an overlay next to it where you pick an action and confirm or cancel it. Tapping the empty space around the overlay or pressing Esc also drops an unsubmitted choice.</p><p>Icons can be hovered for a description, and a tap on a phone shows a three second tip.</p>"
                }
            }
        ]
    };

    // The full clue list only exists once a game is running, so it is folded
    // into the catalogue section right before the dialog opens.
    function refreshCryptidClueCatalogue() {
        const section = CRYPTID_HELP_CONFIG.sections.find(item => item.id === "clues");
        if (!section) return;
        const items = (view?.catalog || []).map(clue => `<li>${esc(clue.description)}</li>`).join("");
        const extra = items ? `<details><summary>All clue types</summary><ul>${items}</ul></details>` : "";
        section.html.zh = CRYPTID_CLUE_BASE.zh + extra;
        section.html.en = CRYPTID_CLUE_BASE.en + extra;
    }

    function initCryptidHelpExplain() {
        if (cryptidHelpWidget || typeof window.obgCreateHelp !== "function") return;
        cryptidHelpWidget = window.obgCreateHelp(CRYPTID_HELP_CONFIG);
        cryptidExplainWidget = window.obgCreateExplain({
            gameId: "cryptid",
            attribute: "data-cryptid-explain",
            explanations: CRYPTID_EXPLAIN,
            button: explainButton,
            root: () => panel,
            bypass: ["#cryptidHelpBtn", "#cryptidExplainBtn", "#cryptidDialogClose"]
        });
        helpButton?.addEventListener("click", () => {
            cryptidExplainWidget?.exit();
            refreshCryptidClueCatalogue();
            cryptidHelpWidget.open();
        });
        explainButton?.addEventListener("click", () => cryptidExplainWidget?.toggle());
    }

    function notebookHTML() {
        const selectedNote = notebookCell ? notesDraft.cells[notebookCell] || "" : "";
        const readonly = !available("update_notes");
        return `<p class="cryptid-muted">${readonly ? "Private · Read only" : "Private · 勾选线索表示手动排除。Save 后保存。"}</p>
            ${notebookCell ? `<label class="cryptid-target-label"><span>${notebookCell}</span><select id="cryptidNoteCell" ${readonly ? "disabled" : ""}><option value="">Unmarked</option><option value="candidate" ${selectedNote === "candidate" ? "selected" : ""}>Candidate</option><option value="excluded" ${selectedNote === "excluded" ? "selected" : ""}>Excluded</option></select></label>` : ""}
            <label for="cryptidNoteText">Notes</label><textarea id="cryptidNoteText" maxlength="4000" ${readonly ? "readonly" : ""}>${esc(notesDraft.text)}</textarea>
            <label class="cryptid-target-label"><span>Player</span><select id="cryptidNotePlayer">${view.players.map(p => `<option value="${esc(p.player_id)}" ${notebookPlayer === p.player_id ? "selected" : ""}>${p.seat + 1} · ${esc(p.name)}</option>`).join("")}</select></label>
            <div class="cryptid-note-clues">${view.catalog.map(clue => `<label><input type="checkbox" data-note-clue="${esc(clue.id)}" ${readonly ? "disabled" : ""} ${(notesDraft.clues[notebookPlayer] || []).includes(clue.id) ? "checked" : ""}/><span>${esc(clue.description)}</span></label>`).join("")}</div>
            <div class="cryptid-actions">${btn("Save", "save_notes", "notes", !available("update_notes"))}${btn("Cancel", "close", "notes")}</div>`;
    }

    function openNotebook() {
        notesDraft = JSON.parse(JSON.stringify(view.notes));
        notebookCell = selected;
        notebookPlayer = view.players.find(p => p.player_id !== view.you)?.player_id || view.you;
        openDialog("📝 Notes", notebookHTML(), "notes");
    }

    function activate(event) {
        if (!view) return;
        const button = event.target.closest("[data-cryptid-action]");
        const cell = event.target.closest("[data-cell]");
        const tipTarget = event.target.closest("[data-cryptid-tip]");
        if (event.detail !== 0 && Date.now() < blockClickUntil && event.target.closest(".cryptid-map")) { event.preventDefault(); return; }
        if (tipTarget && !cell) { showTip(tipTarget.dataset.cryptidTip, tipTarget, event.pointerType === "touch"); return; }
        if (cell) { selectCell(cell.dataset.cell); return; }
        if (!button) {
            if (selected && !event.target.closest("button,input,select,label,details,textarea,.cryptid-box,.cryptid-map-tools,.cryptid-map-status,.cryptid-selection-card")) cancelSelection();
            return;
        }
        if (button.disabled) return;
        const action = button.dataset.cryptidAction;
        if (action === "question" || action === "search") { mode = action; render(); }
        else if (action === "confirm") submit(actionCandidate());
        else if (action === "cancel_selection") cancelSelection();
        else if (action === "next") submit({type: "next_round"});
        else if (action === "hint_yes" || action === "hint_no") submit({type: "vote_hint", agree: action === "hint_yes"});
        else if (action === "in") setZoom(zoom * 1.25);
        else if (action === "out") setZoom(zoom / 1.25);
        else if (action === "fit") { center = {x: W / 2, y: H / 2}; setZoom(1); }
        else if (action === "notes") openNotebook();
        else if (action === "clue") openClue();
        else if (action === "highlight") { showClue = !showClue; render(); panel.querySelector('[data-cryptid-action="highlight"]')?.focus({preventScroll: true}); }
        else if (action === "close") dialog.close();
        else if (action === "save_notes") { const notes = notesDraft; dialog.close(); submit({type: "update_notes", notes}); }
    }
    panel.addEventListener("click", activate); dialogBody.addEventListener("click", activate);
    panel.addEventListener("change", event => {
        if (event.target.id === "cryptidTarget") { target = event.target.value; render(); }
    });
    dialogBody.addEventListener("input", event => {
        if (!notesDraft) return;
        if (event.target.id === "cryptidNoteText") notesDraft.text = event.target.value;
    });
    dialogBody.addEventListener("change", event => {
        if (event.target.id === "cryptidShowClue") {
            showClue = event.target.checked; render();
            if (showClue) { returnFocus = null; returnFocusAction = "highlight"; dialog.close(); }
        }
        if (!notesDraft) return;
        if (event.target.id === "cryptidNotePlayer") { notebookPlayer = event.target.value; dialogBody.innerHTML = notebookHTML(); }
        if (event.target.id === "cryptidNoteCell" && notebookCell) { if (event.target.value) notesDraft.cells[notebookCell] = event.target.value; else delete notesDraft.cells[notebookCell]; }
        if (event.target.dataset.noteClue) {
            const set = new Set(notesDraft.clues[notebookPlayer] || []);
            event.target.checked ? set.add(event.target.dataset.noteClue) : set.delete(event.target.dataset.noteClue);
            notesDraft.clues[notebookPlayer] = [...set];
        }
    });

    function resetGesture() {
        pointers.clear(); gesture = null;
        panel.querySelector(".cryptid-map")?.classList.remove("is-dragging");
    }
    panel.addEventListener("pointerdown", event => {
        const svg = event.target.closest(".cryptid-map");
        if (!svg || selected || event.button > 0) return;
        svg.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
        const points = [...pointers.values()];
        gesture = {center: {...center}, zoom, start: points[0], cell: event.target.closest("[data-cell]")?.dataset.cell, distance: points.length > 1 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0, moved: pointers.size > 1};
        if (pointers.size > 1) blockClickUntil = Date.now() + 1000;
    });
    panel.addEventListener("pointermove", event => {
        if (!pointers.has(event.pointerId) || !gesture) return;
        const svg = panel.querySelector(".cryptid-map");
        pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
        const points = [...pointers.values()];
        const dx = points[0].x - gesture.start.x, dy = points[0].y - gesture.start.y;
        if (Math.hypot(dx, dy) > 6 || pointers.size > 1) {
            gesture.moved = true; blockClickUntil = Date.now() + 700; hideTip();
            svg.classList.add("is-dragging");
            if (points.length > 1 && gesture.distance > 0) zoom = Math.max(1, Math.min(3.4, gesture.zoom * Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / gesture.distance));
            const rect = svg.getBoundingClientRect();
            const unit = Math.min(rect.width / (W / gesture.zoom), rect.height / (H / gesture.zoom));
            center = {x: gesture.center.x - dx / unit, y: gesture.center.y - dy / unit}; updateMap();
        }
    });
    function endPointer(event) {
        if (!pointers.has(event.pointerId)) return;
        const tappedCell = event.type === "pointerup" && !gesture?.moved && pointers.size === 1 ? gesture?.cell : null;
        const hitCell = tappedCell ? document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-cell]")?.dataset.cell : null;
        if (gesture?.moved) blockClickUntil = Date.now() + 700;
        pointers.delete(event.pointerId);
        if (!pointers.size) resetGesture();
        else {
            const points = [...pointers.values()];
            gesture = {center: {...center}, zoom, start: points[0], distance: 0, moved: true};
        }
        if (tappedCell && hitCell === tappedCell) {
            blockClickUntil = Date.now() + 700;
            suppressed = {x: event.clientX, y: event.clientY, until: Date.now() + 900};
            selectCell(tappedCell);
        }
    }
    panel.addEventListener("pointerup", endPointer);
    panel.addEventListener("pointercancel", event => { blockClickUntil = Date.now() + 700; endPointer(event); });
    panel.addEventListener("lostpointercapture", endPointer);
    panel.addEventListener("wheel", event => {
        if (!event.target.closest(".cryptid-map")) return;
        event.preventDefault(); setZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
    }, {passive: false});
    panel.addEventListener("keydown", event => {
        if (event.target.closest("[data-cell]") && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.target.dispatchEvent(new MouseEvent("click", {bubbles: true})); }
    });

    document.addEventListener("pointerdown", () => { suppressed = null; }, true);
    document.addEventListener("click", event => {
        if (suppressed && Date.now() < suppressed.until && Math.abs(event.clientX - suppressed.x) < 5 && Math.abs(event.clientY - suppressed.y) < 5) {
            event.preventDefault(); event.stopImmediatePropagation(); suppressed = null; return;
        }
    }, true);
    document.addEventListener("keydown", event => {
        if (!view || event.defaultPrevented) return;
        if (event.key === "Escape") {
            hideTip(); resetGesture();
            if (!dialog.open && selected) cancelSelection();
        }
    }, true);
    panel.addEventListener("pointerover", event => { const el = event.target.closest("[data-cryptid-tip]"); if (el && event.pointerType !== "touch" && !pointers.size) showTip(el.dataset.cryptidTip, el); });
    panel.addEventListener("pointerout", event => { if (event.pointerType !== "touch") hideTip(); });
    panel.addEventListener("focusin", event => { const el = event.target.closest("[data-cryptid-tip]"); if (el) showTip(el.dataset.cryptidTip, el); });
    panel.addEventListener("focusout", hideTip);
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener("close", () => {
        if (dialog.open) return;
        notesDraft = null; hideTip(); updateDockButtons();
        const focus = returnFocus?.isConnected ? returnFocus : panel.querySelector(`[data-cryptid-action="${returnFocusAction}"]`);
        focus?.focus({preventScroll: true});
    });
    window.addEventListener("resize", () => {
        hideTip(); resetGesture();
        const narrow = window.innerWidth < 600;
        if (narrow !== narrowLayout) { zoom = initialZoom(); center = {x: W / 2, y: H / 2}; }
        narrowLayout = narrow; updateMap();
    });
    window.addEventListener("blur", resetGesture);
    window.addEventListener("scroll", positionSelection, {passive: true, capture: true});
    window.visualViewport?.addEventListener("resize", positionSelection);
    window.visualViewport?.addEventListener("scroll", positionSelection);

    function clearState() {
        view = null; signature = null; selected = null; target = ""; pending = false;
        cryptidExplainWidget?.exit(); hideTip(); resetGesture(); window.clearTimeout(pendingTimer);
        if (dialog.open) dialog.close();
        dialogBody.replaceChildren(); notesDraft = null; returnFocusAction = null; panel.innerHTML = "";
    }
    window.renderCryptidGameState = data => {
        if (!data?.view) return;
        const next = data.view;
        const sig = JSON.stringify([next.game_instance_id, next.phase, next.current_turn, next.round]);
        if (view?.game_instance_id !== next.game_instance_id) { zoom = initialZoom(); center = {x: W / 2, y: H / 2}; showClue = false; mode = "question"; if (dialog.open) dialog.close(); }
        if (signature !== sig) { selected = null; target = ""; resetGesture(); }
        signature = sig; view = next; pending = false; window.clearTimeout(pendingTimer); render();
    };
    window.showCryptidHeaderActions = visible => { header.style.display = visible ? "flex" : "none"; if (!visible) clearState(); };
    window.clearCryptidState = clearState;
    window.getCryptidConfig = () => ({advanced: document.getElementById("cryptidMode").value === "advanced"});
    window.updateCryptidConfigRow = () => {
        const box = document.getElementById("cryptidConfigBox");
        const visible = currentGameType === "cryptid" && currentRoomState?.status === "lobby";
        box.classList.toggle("hidden", !visible); box.setAttribute("aria-hidden", String(!visible));
    };
    function connectEvents() {
        socket.on("system:error", () => { if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); } });
        const syncRoomConfig = state => {
            if (!state) return;
            if (state.game_type === "cryptid" && state.game_config && state.game_config.advanced !== undefined) document.getElementById("cryptidMode").value = state.game_config.advanced ? "advanced" : "normal";
        };
        socket.on("room:state", syncRoomConfig);
        if (typeof currentRoomState !== "undefined") syncRoomConfig(currentRoomState);
    }
    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", initCryptidHelpExplain, {once: true});
    } else {
        initCryptidHelpExplain();
    }
    if (document.readyState === "loading" || typeof socket === "undefined") {
        window.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    } else {
        connectEvents();
    }
})();
