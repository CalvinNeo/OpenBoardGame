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
    const explanations = {
        map: "点选六边形查看坐标、地形、动物与标记；拖动或缩放不会提交动作。熊(🐻)用虚线，美洲狮(🐾)用实线边界。结构物有独立的类型与颜色。",
        question: "询问(❓)：选择无排除(■)的格子和尚未回答该格的另一名玩家。可以询问不符合自己线索的位置。系统诚实给出可能(●)或排除(■)；得到排除后，你须另放一个方块。",
        search: "搜索(🔍)：只能搜索符合自己线索、无排除(■)的格子。先放可能(●)；若已有自己的圆片，先在别处补圆片。依席位核对，首个否定后停止并补方块；全部通过才获胜。",
        place: "排除(■)必须不符合你的线索，可能(●)必须符合。标记不能重复；有任何方块的格子都不能再互动。当前阶段只允许所需标记的合法新位置。",
        confirm: "Confirm 提交当前选择。请先选合法格子；询问(❓)还需选一名尚未回答的对手。等待其他人、回顾未结束或发送中时不可提交。",
        next: "每圈结束暂停回顾。每人分别点击 Next Round，全员确认才继续。机器人只确认自己，断线真人不会自动跳过。",
        notes: "笔记(📝)仅你可见：手动标记候选／排除格，或勾掉你认为不成立的对手线索。Save 保存到个人笔记，Close／Esc 放弃未保存编辑。不会替你自动推理。",
        clue: "My clue 只高亮符合你自己的秘密线索的格子。高亮不代表符合别人线索，也不排除已出现方块的位置。距离包括目标本身，within 2 表示 0、1、2 格。",
        hint: "提示(💡)需要投票：三人全部同意；四或五人至少人数减一同意。每局最多公开一次未使用的线索类别；没有可用类别时，在投票通过后说明。开局未完成或已揭示时不可投票。",
        zoom: "使用 +／− 缩放，Fit 查看整张地图。地图区域内拖动平移，手机支持双指缩放；区域外正常滚动页面。",
        legend: "可能(●)只符合放置者的线索，排除(■)则让整格停止互动。玩家用颜色和座位编号区分；结构物的颜色与玩家归属无关。",
    };
    let view = null, signature = null, selected = null, target = "", mode = "question";
    let pending = false, pendingTimer = null, explaining = false, suppressed = null;
    let zoom = 1, center = {x: W / 2, y: H / 2}, showClue = false;
    let notesDraft = null, notebookPlayer = "", notebookCell = null, returnFocus = null;
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
        return `<svg class="cryptid-map" viewBox="0 0 ${W} ${H}" aria-label="Cryptid hex map" role="group">
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
                    <polygon class="cryptid-cell-shape" points="${hexPoints(38)}" fill="${terrain.color}"/>
                    ${cell.animal ? `<polygon class="cryptid-territory is-${cell.animal}" points="${hexPoints(34)}"/>` : ""}
                    <text class="cryptid-cell-icon" y="-12">${terrain.icon}</text>${extra.join("")}${markers}
                    ${note ? `<circle cx="27" cy="0" r="5" fill="${note === "candidate" ? "#fff28a" : "#fbf9f0"}" stroke="#26372f" stroke-width="1.5"/>` : ""}
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

    function selectedHTML() {
        const cell = view.board.find(item => item.id === selected);
        if (!cell) return `<p class="cryptid-muted">Select a space on the map.</p>`;
        const t = view.terrain_defs[cell.terrain];
        const details = cellDescription(cell).split("；").slice(1);
        return `<div class="cryptid-selection"><strong>${cell.id}</strong> · ${t.name}(${t.icon})<div class="cryptid-detail-list">${details.map(part => `<span>${esc(part)}</span>`).join("") || "尚无公开标记"}</div></div>`;
    }

    function actionHTML() {
        if (view.game_over) return "";
        const question = available("question");
        const options = view.players.filter(p => p.player_id !== view.you);
        const phaseExplanation = view.phase === "turn" ? mode : view.phase === "round_end" ? "next" : "place";
        return `<section class="cryptid-box cryptid-action-box"><h3 data-cryptid-explain="${phaseExplanation}">${phaseNames[view.phase]}</h3><p class="cryptid-muted" aria-live="polite">${esc(stepText())}</p>
            ${view.phase === "turn" ? `<div class="cryptid-mode-buttons">${btn("❓ 询问", "question", "question", !question, `class="${mode === "question" ? "is-active" : ""}" aria-pressed="${mode === "question"}"`)}${btn("🔍 搜索", "search", "search", !available("search"), `class="${mode === "search" ? "is-active" : ""}" aria-pressed="${mode === "search"}"`)}</div>` : ""}
            ${selectedHTML()}
            ${view.phase === "turn" && mode === "question" ? `<label class="cryptid-target-label"><span>Ask</span><select id="cryptidTarget" ${!question ? "disabled" : ""}><option value="">Select player</option>${options.map(p => `<option value="${esc(p.player_id)}" ${target === p.player_id ? "selected" : ""} ${selected && (view.markers[selected].cube || view.markers[selected].discs.includes(p.player_id)) ? "disabled" : ""}>${p.seat + 1} · ${esc(p.name)}</option>`).join("")}</select></label>` : ""}
            ${view.phase !== "round_end" ? `<div class="cryptid-actions">${btn("Confirm", "confirm", "confirm", !actionCandidate(), 'class="cryptid-primary"')}</div>` : ""}
            ${view.phase === "round_end" ? `<div class="cryptid-actions">${btn(view.next_ready.includes(view.you) ? "Ready ✓" : "Next Round", "next", "next", !available("next_round"), 'class="cryptid-primary"')}</div><p class="cryptid-muted">Waiting: ${esc(view.players.filter(p => !view.next_ready.includes(p.player_id)).map(p => p.name).join(", ")) || "—"}</p>` : ""}
        </section>`;
    }

    function resultsHTML() {
        if (!view.last_action) return "";
        const a = view.last_action;
        return `<section class="cryptid-box"><h3>${a.type === "search" ? "🔍" : "❓"} ${a.cell_id} · ${esc(name(a.actor))}</h3><div class="cryptid-results">${a.results.map(r => `<div class="cryptid-result"><span class="cryptid-dot" style="background:${color(r.player_id)}"></span>${esc(name(r.player_id))} · ${r.positive ? "可能(●)" : "排除(■)"}${r.already_present ? " · 已有圆片" : ""}</div>`).join("")}</div></section>`;
    }

    function render() {
        if (!view) return;
        resetGesture(); hideTip();
        panel.innerHTML = `<div class="cryptid-shell"><div class="cryptid-top"><div><div class="cryptid-eyebrow">A field guide to the unknown</div><h2>诡影寻踪 <span lang="en">Cryptid</span></h2></div><span class="cryptid-badge">${view.advanced ? "Advanced" : "Normal"} · ${view.round ? `Round ${view.round}` : "Setup"}</span></div>
            <div class="cryptid-players">${view.players.map(p => `<div class="cryptid-player ${p.player_id === view.current_turn ? "is-current" : ""}"><strong><span class="cryptid-dot" style="background:${color(p.player_id)}"></span>${p.seat + 1} · ${esc(p.name)}</strong><small>${p.player_id === view.you ? "You" : p.is_bot ? "Bot" : "Player"}${p.player_id === view.current_turn ? " · Acting" : view.next_ready.includes(p.player_id) ? " · Ready ✓" : ""}</small></div>`).join("")}</div>
            <div class="cryptid-layout"><div class="cryptid-map-area"><div class="cryptid-map-frame"><div class="cryptid-map-tools"><div>${btn("−", "out", "zoom")}${btn("+", "in", "zoom")}${btn("Fit", "fit", "zoom")}<span class="cryptid-zoom">${Math.round(zoom * 100)}%</span></div><div>${btn("📝 Notes", "notes", "notes", !view.notes)}</div></div>${mapHTML()}</div>
                <div class="cryptid-legend">${Object.values(view.terrain_defs).map(t => `<button type="button" data-cryptid-explain data-cryptid-tip="${esc(`${t.name}(${t.icon})：五种地形之一。`)}">${t.icon} ${t.name}</button>`).join("")}<button type="button" data-cryptid-explain="legend" data-cryptid-tip="${esc(explanations.legend)}">● / ■</button><button type="button" data-cryptid-explain data-cryptid-tip="熊(🐻)用虚线边界，美洲狮(🐾)用实线边界；领地叠加在地形上。">🐻 / 🐾</button><button type="button" data-cryptid-explain data-cryptid-tip="立石(🗿)与废弃小屋(🏚️)；色框表示结构物的白、绿、蓝、黑颜色，与玩家颜色无关。">🗿 / 🏚️</button></div>
                ${view.phase === "round_end" ? `<section class="cryptid-box cryptid-review"><h3>Round review</h3><ul class="cryptid-history">${view.last_round.map(line => `<li>${esc(line)}</li>`).join("")}</ul></section>` : ""}
                ${view.game_over ? `<section class="cryptid-box cryptid-review"><h3>🏆 ${esc(name(view.winner[0]))} · ${view.solution}</h3><div class="cryptid-results">${view.players.map(p => `<div class="cryptid-result"><strong>${esc(p.name)}</strong>：${esc(view.revealed_clues[p.player_id].description)}</div>`).join("")}</div></section>` : ""}
            </div><div class="cryptid-sidebar">${view.my_clue ? `<section class="cryptid-box cryptid-clue" data-cryptid-explain="clue"><h3 data-cryptid-tip="秘密线索(🔒)：仅你可见，神秘生物所在格必须符合它。">🔒 Your clue</h3><p>${esc(view.my_clue.description)}</p><label class="cryptid-inline-label"><input id="cryptidShowClue" type="checkbox" ${showClue ? "checked" : ""}/><span>My clue</span></label></section>` : ""}${actionHTML()}${resultsHTML()}
                ${!view.game_over || view.hint ? `<section class="cryptid-box" data-cryptid-explain="hint"><h3 data-cryptid-tip="提示(💡)：表决通过后公开一个额外线索类别，每局最多一次。">💡 Hint</h3>${view.hint ? `<p class="cryptid-muted">${esc(view.hint)}</p>` : `<p class="cryptid-muted">${Object.values(view.hint_votes).filter(Boolean).length} / ${view.players.length === 3 ? 3 : view.players.length - 1} votes</p><div class="cryptid-actions">${btn("Agree", "hint_yes", "hint", !available("vote_hint"))}${btn("Decline", "hint_no", "hint", !available("vote_hint"))}</div>`}</section>` : ""}
                <details class="cryptid-box"><summary>Public log</summary><ul class="cryptid-history">${view.log.slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ul></details>
            </div></div><p class="cryptid-footer">${esc(view.map_source)} · ${view.catalog.length} clue types</p></div>`;
        panel.classList.toggle("is-explaining", explaining);
        updateMap();
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
    }

    function setZoom(value) { zoom = Math.max(1, Math.min(3.4, value)); updateMap(); hideTip(); }
    function setExplain(value) {
        explaining = value; panel.classList.toggle("is-explaining", value);
        explainButton.setAttribute("aria-pressed", String(value)); hideTip();
    }
    function explainElement(element) {
        if (!element) return;
        const text = explanations[element.dataset.cryptidExplain] || element.dataset.cryptidTip || explanations.map;
        setExplain(false); openDialog("Explain", `<p>${esc(text)}</p>`);
    }
    function submit(action) {
        if (!action || !available(action.type)) return;
        pending = true; hideTip(); render(); sendAction(action);
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; render(); }, 6000);
    }
    function openDialog(title, html, kind = "reference") {
        hideTip(); returnFocus = document.activeElement;
        dialogTitle.textContent = title; dialogBody.innerHTML = html;
        dialog.classList.toggle("is-notebook", kind === "notes"); dialog.dataset.kind = kind;
        if (!dialog.open) dialog.showModal();
    }

    function showHelp() {
        setExplain(false);
        openDialog("Help · 诡影寻踪", `<p>3–5 位研究者各持一条秘密线索，地图上只有一个格子符合全部人的线索。先成功搜索该格的玩家获胜；仅在笔记中推断出来不算获胜。</p>
            <h3>开局与标记</h3><p>依起始席位，每人轮流放一个排除(■)，共两圈，每人两个。可能(●)表示符合放置者自己的线索，排除(■)表示不符合。每格可以有不同玩家的圆片，但至多一个方块；方块出现后不能再对该格进行任何操作。自己的标记不可重复，标记不移走。</p>
            <h3>地形与距离</h3><p>森林(🌲)、沙漠(🏜️)、水域(🌊)、山地(⛰️)、沼泽(🌿)是五种地形。熊(🐻)与美洲狮(🐾)是叠加的领地。立石(🗿)与废弃小屋(🏚️)分别有不同颜色。按六边形相邻格计距，包括目标自身的 0 格；地形不阻挡距离。</p>
            <h3>每回合二选一</h3><p>${explanations.question}</p><p>${explanations.search}</p><p>搜索中已有对方圆片就跳过此人。补圆片不改变原搜索格；遇到首个方块立即停止，后续玩家不泄露结果。搜索失败不出局，补方块后继续正常轮转。</p>
            <h3>线索目录</h3><p>普通模式包含两种地形之一、1 格内某地形、1 格内任意动物、2 格内某类结构物、2 格内某种动物、3 格内某颜色结构物，共 23 条。进阶增加黑色结构物及完整条件的否定，共 48 条。例如“不满足：位于森林或水域”是既非森林也非水域；“不在 2 格内”是距离大于 2。建筑类型线索忽略颜色，颜色线索忽略类型。</p>
            <details><summary>All clue types</summary><ul>${(view?.catalog || []).map(clue => `<li>${esc(clue.description)}</li>`).join("")}</ul></details>
            <h3>提示、笔记与回顾</h3><p>${explanations.hint}</p><p>${explanations.notes}</p><p>${explanations.next}</p>
            <h3>线上适配</h3><p>强制回答由服务器诚实计算。仅当所有合法新落点已耗尽时，免除对应的额外圆片／补偿方块，并公开记录。这是避免卡局的线上约定。地图地形依据官方辅助站转录，题目独立生成并验证唯一解；界面使用原创图形。普通模式六个结构物，进阶八个。没有双人规则或 Urban Legends 模式。</p>
            <h3>地图操作</h3><p>${explanations.zoom}</p><p>点选后使用 Confirm 提交。空白或 Esc 取消未提交选择。Notes 从右侧打开；Save 保存私人笔记。图标可悬停查看说明，手机轻点显示三秒提示。</p>`);
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
        if (Date.now() < blockClickUntil && event.target.closest(".cryptid-map")) { event.preventDefault(); return; }
        if (tipTarget && !cell) { showTip(tipTarget.dataset.cryptidTip, tipTarget, event.pointerType === "touch"); return; }
        if (cell) { selected = cell.dataset.cell; target = ""; render(); if (event.pointerType === "touch") showTip(cellDescription(view.board.find(c => c.id === selected)), panel, true); return; }
        if (!button) {
            if (!event.target.closest("button,input,select,label,details,textarea,.cryptid-box,.cryptid-map-tools")) { selected = null; target = ""; render(); }
            return;
        }
        if (button.disabled) return;
        const action = button.dataset.cryptidAction;
        if (action === "question" || action === "search") { mode = action; render(); }
        else if (action === "confirm") submit(actionCandidate());
        else if (action === "next") submit({type: "next_round"});
        else if (action === "hint_yes" || action === "hint_no") submit({type: "vote_hint", agree: action === "hint_yes"});
        else if (action === "in") setZoom(zoom * 1.25);
        else if (action === "out") setZoom(zoom / 1.25);
        else if (action === "fit") { center = {x: W / 2, y: H / 2}; setZoom(1); }
        else if (action === "notes") openNotebook();
        else if (action === "close") dialog.close();
        else if (action === "save_notes") { const notes = notesDraft; dialog.close(); submit({type: "update_notes", notes}); }
    }
    panel.addEventListener("click", activate); dialogBody.addEventListener("click", activate);
    panel.addEventListener("change", event => {
        if (event.target.id === "cryptidTarget") { target = event.target.value; render(); }
        if (event.target.id === "cryptidShowClue") { showClue = event.target.checked; render(); }
    });
    dialogBody.addEventListener("input", event => {
        if (!notesDraft) return;
        if (event.target.id === "cryptidNoteText") notesDraft.text = event.target.value;
    });
    dialogBody.addEventListener("change", event => {
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
        if (!svg || explaining || event.button > 0) return;
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
            blockClickUntil = Date.now() + 700; selected = tappedCell; target = ""; render();
            if (event.pointerType === "touch") showTip(cellDescription(view.board.find(c => c.id === selected)), panel, true);
        }
    }
    panel.addEventListener("pointerup", endPointer);
    panel.addEventListener("pointercancel", event => { blockClickUntil = Date.now() + 700; endPointer(event); });
    panel.addEventListener("lostpointercapture", endPointer);
    panel.addEventListener("wheel", event => {
        if (!event.target.closest(".cryptid-map") || explaining) return;
        event.preventDefault(); setZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
    }, {passive: false});
    panel.addEventListener("keydown", event => {
        if (event.target.closest("[data-cell]") && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.target.dispatchEvent(new MouseEvent("click", {bubbles: true})); }
    });

    document.addEventListener("pointerdown", event => {
        if (!explaining || !view) return;
        if ([helpButton, explainButton, dialogClose].includes(event.target)) return;
        let element = event.target.closest("[data-cryptid-explain]");
        if (!element) element = [...panel.querySelectorAll("[data-cryptid-explain]")].find(item => {
            const r = item.getBoundingClientRect(); return r.width && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
        });
        event.preventDefault(); event.stopImmediatePropagation();
        suppressed = {x: event.clientX, y: event.clientY, until: Date.now() + 900};
        explainElement(element);
    }, true);
    document.addEventListener("click", event => {
        if (suppressed && Date.now() < suppressed.until && Math.abs(event.clientX - suppressed.x) < 5 && Math.abs(event.clientY - suppressed.y) < 5) {
            event.preventDefault(); event.stopImmediatePropagation(); suppressed = null; return;
        }
        if (!explaining || !view || [helpButton, explainButton, dialogClose].includes(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const element = event.target.closest("[data-cryptid-explain]");
        explainElement(element);
    }, true);
    document.addEventListener("keydown", event => {
        if (!view) return;
        if (event.key === "Escape") {
            hideTip(); resetGesture();
            if (explaining) { event.preventDefault(); setExplain(false); }
            else if (!dialog.open) { selected = null; target = ""; render(); }
        } else if (explaining && ["Enter", " "].includes(event.key) && event.target.matches("input,select,textarea")) {
            event.preventDefault(); event.stopImmediatePropagation();
            explainElement(event.target.closest("[data-cryptid-explain]"));
        }
    }, true);
    panel.addEventListener("pointerover", event => { const el = event.target.closest("[data-cryptid-tip]"); if (el && event.pointerType !== "touch" && !explaining && !pointers.size) showTip(el.dataset.cryptidTip, el); });
    panel.addEventListener("pointerout", event => { if (event.pointerType !== "touch") hideTip(); });
    panel.addEventListener("focusin", event => { const el = event.target.closest("[data-cryptid-tip]"); if (el && !explaining) showTip(el.dataset.cryptidTip, el); });
    panel.addEventListener("focusout", hideTip);
    helpButton.addEventListener("click", showHelp);
    explainButton.addEventListener("click", () => setExplain(!explaining));
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener("close", () => { notesDraft = null; hideTip(); if (returnFocus?.isConnected) returnFocus.focus(); });
    window.addEventListener("resize", () => {
        hideTip(); resetGesture();
        const narrow = window.innerWidth < 600;
        if (narrow !== narrowLayout) { zoom = initialZoom(); center = {x: W / 2, y: H / 2}; }
        narrowLayout = narrow; updateMap();
    });
    window.addEventListener("blur", resetGesture);

    function clearState() {
        view = null; signature = null; selected = null; target = ""; pending = false;
        setExplain(false); hideTip(); resetGesture(); window.clearTimeout(pendingTimer);
        if (dialog.open) dialog.close(); panel.innerHTML = "";
    }
    window.renderCryptidGameState = data => {
        if (!data?.view) return;
        const next = data.view;
        const sig = JSON.stringify([next.game_instance_id, next.phase, next.current_turn, next.round]);
        if (view?.game_instance_id !== next.game_instance_id) { zoom = initialZoom(); center = {x: W / 2, y: H / 2}; showClue = false; if (dialog.open) dialog.close(); }
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
    window.addEventListener("DOMContentLoaded", () => {
        socket.on("system:error", () => { if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); } });
        socket.on("room:state", state => {
            if (state.game_type === "cryptid" && state.game_config && state.game_config.advanced !== undefined) document.getElementById("cryptidMode").value = state.game_config.advanced ? "advanced" : "normal";
        });
    }, {once: true});
})();
