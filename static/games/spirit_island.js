(() => {
    "use strict";
    const panel = document.getElementById("spiritIslandPanel");
    const header = document.getElementById("spiritIslandHeaderActions");
    const helpButton = document.getElementById("spiritIslandHelpBtn");
    const explainButton = document.getElementById("spiritIslandExplainBtn");
    if (!panel || !header || !helpButton || !explainButton) return;
    const colors = ["#db773d", "#63a8dc", "#b687ce", "#e3c356"];
    const terrain = {
        mountain: {name: "山地", icon: "⛰️", color: "#ccc9c0", shade: "#a4ada8"},
        jungle: {name: "丛林", icon: "🌳", color: "#94b58c", shade: "#588e70"},
        sand: {name: "沙地", icon: "🏜️", color: "#e6c68a", shade: "#cba264"},
        wetland: {name: "湿地", icon: "💧", color: "#9dcbd0", shade: "#67a5ab"},
    };
    const elements = {sun: "☀️", moon: "🌙", fire: "🔥", air: "💨", water: "💧", earth: "🪨", plant: "🌿", animal: "🐾"};
    const elementNames = {sun: "日", moon: "月", fire: "火", air: "气", water: "水", earth: "土", plant: "木", animal: "兽"};
    const phaseNames = {choose_spirit: "选择精灵", growth: "精灵成长", play: "准备法术", fast: "快速法术", fear: "恐惧", ravage: "蹂躏", build: "建造", explore: "探索", slow: "慢速法术", round_end: "本轮回顾", game_over: "守护之战结束"};
    const phaseSteps = [["growth", "🌱", "成长"], ["play", "🃏", "出牌"], ["fast", "⚡", "快速"], ["fear", "👁️", "恐惧"], ["ravage", "⚔️", "蹂躏"], ["build", "🏘️", "建造"], ["explore", "🚶", "探索"], ["slow", "🐢", "慢速"], ["round_end", "🌙", "回顾"]];
    const explanations = {
        spirit: "每位玩家选择一位不同的精灵。精灵的特殊规则、成长选项、能量与出牌轨道、起始法术和先天法术各不相同。选择后点击 Confirm，全员选定后进入成长阶段。",
        map: "土地编号（如 A1）由岛板字母和土地数字组成。山地(⛰️)、丛林(🌳)、沙地(🏜️)、湿地(💧)决定入侵者行动。海岸(🌊)与海洋相邻。虚线显示相邻关系；以选中土地的 Adjacent 列表为准，画面距离不代表法术距离。点土地查看详情并筛选合法目标。",
        presence: "存在／灵迹(●)表示你的精灵能触及这片土地；同一精灵在一块土地上有至少两个存在，构成圣地(◎)。颜色和座位编号区分各精灵。放置存在可解锁能量(⚡)或出牌(🃏)轨道。",
        invaders: "探索者(🚶)：生命和伤害各 1；村镇(🏘️)：各 2；城市(🏙️)：各 3。摧毁村镇产生 1 恐惧(👁️)，摧毁城市产生 2。移除与推动不会因此产生恐惧。",
        dahan: "达汉(🛖)各有 2 生命。蹂躏时，入侵者同时伤害土地和达汉；存活达汉各反击 2 伤害。达汉不会替土地吸收伤害。防御(🛡️)减少该土地的入侵者总伤害。",
        blight: "荒芜(☠️)：土地一次遭受至少 2 点伤害，加入一个荒芜，并摧毁每位精灵在当地的一个存在。原有荒芜时会蔓延到一块相邻土地。本入门模式不使用荒芜卡；荒芜供应耗尽则全队失败。",
        fear: "恐惧(👁️)累积到阈值后获得一张恐惧牌，并重置池中恐惧；已获得的牌在恐惧阶段结算。恐惧等级 I：消灭全部入侵者；II：消灭全部村镇(🏘️)和城市(🏙️)；III：消灭全部城市(🏙️)。获得最后一张恐惧牌立即胜利。",
        growth: "每轮选一个成长(🌱)选项，依提示选择轨道和存在落点。不同精灵有不同的成长组合。成长完成后，按已解锁能量轨道获得能量(⚡)，再准备法术。本入门模式按各精灵预设的成长牌序获得法术。",
        card: "法术牌(🃏)支付能量(⚡)后打出，受到出牌轨道上限限制。⚡ 为快速法术，🐢 为慢速法术；元素从打出时即提供到本轮结束，使用法术不会消耗元素。法术的距离、目标条件和合法选项由服务器验证。点牌查看详情，选择动作后 Confirm。",
        power: "快速(⚡)与慢速(🐢)阶段，全队可商量执行顺序。使用法术后按提示逐步选择土地、目标与效果。每张牌及每个先天法术通常每轮使用一次，重复法术等明确效果可以打破此限制；跳过或结束阶段前请确认不再使用剩余法术。",
        tracks: "能量轨道(⚡)显示每轮收入，出牌轨道(🃏)显示每轮可打出的牌数。移走轨道存在时解锁更靠右的值。此处显示精灵面板数据；当前能量是你已经拥有、可用于支付法术的资源。",
        invader_plan: "入侵者依次结算：恐惧(👁️) → 蹂躏(⚔️) → 建造(🏘️) → 探索(🚶)。蹂躏和建造只影响牌上地形；探索只在海岸、当地有村镇／城市，或与村镇／城市相邻的对应土地放探索者。随后入侵牌向左移动。",
        ready: "Ready 完成你在当前阶段的准备。合作阶段需要各自确认；一旦所有精灵就绪，游戏才进入下个阶段。先检查已打出法术和剩余可用效果。",
        confirm: "Confirm 只提交高亮的动作。先选择法术、土地或下方提供的合法选项。灰色表示尚未选动作、没有合法动作或正在发送。点击区域空白或按 Esc 可取消未提交选择。",
        choice: "此处列出服务器验证过的合法选项。先选一项，再点击 Confirm 提交。法术中的目标、伤害分配、聚集／推动和荒芜蔓延会分步询问，所有选择都通过按钮完成。",
        next: "每轮时间流逝后暂停回顾，查看地图与本轮日志。所有玩家都点击 Next Round 才开始下一轮；已确认者显示 Ready，尚未确认的真人不会被自动跳过。",
        history: "公共日志(📜)记录每轮成长、法术和入侵者行动。可以在此区域内滚动查看；圆末暂停让所有玩家核对局势。",
    };
    const dialog = document.createElement("dialog");
    dialog.className = "spirit-island-dialog";
    dialog.innerHTML = '<div class="si-dialog-head"><h2></h2><button type="button" data-si-close>Close</button></div><div class="si-dialog-body"></div>';
    document.body.append(dialog);
    const dialogTitle = dialog.querySelector("h2"), dialogBody = dialog.querySelector(".si-dialog-body"), dialogClose = dialog.querySelector("[data-si-close]");
    const tip = document.createElement("div");
    tip.className = "spirit-island-tip"; tip.hidden = true; tip.setAttribute("role", "status"); document.body.append(tip);
    let view = null, selectedLand = null, selectedCard = null, selectedOption = null, activeBoard = "home", cardTab = "hand", mobileTab = "island";
    let pending = false, pendingTimer = null, explaining = false, suppressed = null, tipTimer = null, returnFocus = null, lastSignature = "";
    let inputKind = "mouse", narrow = window.innerWidth < 720, spiritDetailsOpen = false;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    const options = () => view?.action_options || [];
    const players = () => view?.players || [];
    const pid = player => player.id ?? player.player_id;
    const me = () => players().find(player => pid(player) === (view?.you ?? view?.viewer_id));
    const pname = id => players().find(player => pid(player) === id)?.name || id || "—";
    const pcolor = id => colors[Math.max(0, players().findIndex(player => pid(player) === id)) % colors.length];
    const spirits = () => Array.isArray(view?.spirits) ? view.spirits : Object.values(view?.spirits || {});
    const spirit = id => spirits().find(item => item.id === id);
    const lands = () => view?.lands || [];
    const boards = () => [...new Set(lands().map(land => land.board))];
    const cardId = card => typeof card === "string" ? card : card.id;
    const allCards = () => [...players().flatMap(player => [...(player.hand || []), ...(player.played || []), ...(player.discard || [])]), ...(view?.choice_cards || [])];
    const findCard = id => allCards().find(card => cardId(card) === id) || (view?.cards || {})[id];
    const cardName = card => card?.name_zh || card?.name || card?.id || "法术";
    const icon = (label, explanation, extra = "") => `<span class="si-icon ${extra}" tabindex="0" data-si-tip="${esc(explanation)}">${label}</span>`;
    const button = (label, action, explain = "choice", disabled = false, extra = "") => `<button type="button" data-si-action="${action}" data-si-explain="${explain}" ${disabled ? "disabled" : ""} ${extra}>${label}</button>`;
    const info = key => button("ⓘ", "info", key, false, `class="si-info" data-si-tip="${esc(explanations[key])}" aria-label="Info"`);
    const optionExplain = option => ({growth: "growth", play_card: "card", unplay_card: "card", use_power: "power", use_innate: "power", ready: "ready", pass: "power", next_round: "next"}[option?.action?.type] || "choice");
    const optionLand = option => option.land_id || option.land || option.action?.land_id || null;
    const optionCard = option => option.card_id || option.action?.card_id || null;

    function hideTip() { tip.hidden = true; window.clearTimeout(tipTimer); }
    function showTip(text, anchor, touch = false) {
        if (!text || !anchor) return;
        window.clearTimeout(tipTimer); tip.textContent = text; tip.hidden = false;
        const bounds = tip.getBoundingClientRect(), rect = anchor.getBoundingClientRect();
        const x = touch ? (window.innerWidth - bounds.width) / 2 : rect.left;
        const y = touch ? (rect.top < window.innerHeight / 2 ? window.innerHeight - bounds.height - 16 : 16) : (rect.top > bounds.height + 16 ? rect.top - bounds.height - 9 : rect.bottom + 9);
        tip.style.left = `${Math.max(12, Math.min(window.innerWidth - bounds.width - 12, x))}px`;
        tip.style.top = `${Math.max(12, Math.min(window.innerHeight - bounds.height - 12, y))}px`;
        if (touch) tipTimer = window.setTimeout(hideTip, 3000);
    }
    function setExplain(value) {
        explaining = value; panel.classList.toggle("is-explaining", value);
        explainButton.setAttribute("aria-pressed", String(value)); hideTip();
    }
    function openDialog(title, html) {
        hideTip(); returnFocus = document.activeElement; dialogTitle.textContent = title; dialogBody.innerHTML = html;
        if (!dialog.open) dialog.showModal();
    }
    function resetSelection() { selectedLand = null; selectedCard = null; selectedOption = null; }
    function submit(option) {
        if (!option || pending || !options().includes(option)) return;
        pending = true; hideTip(); render(); sendAction(option.action);
        window.clearTimeout(pendingTimer); pendingTimer = window.setTimeout(() => { pending = false; render(); }, 7000);
    }
    function showHelp() {
        setExplain(false);
        openDialog("Help · 灵迹岛", `<p>1–4 位玩家合作扮演岛屿精灵，保护土地与达汉(🛖)，驱逐入侵者。每位玩家选择一个不同精灵，并控制自己的存在(●)、能量(⚡)和法术(🃏)。所有人共同胜负。</p>
            <h3>胜利与失败</h3><p>${explanations.fear}</p><p>任意一位精灵失去岛上全部存在(●)、荒芜(☠️)供应耗尽，或需要探索却无法抽入侵牌时，全队失败。</p>
            <h3>一轮的顺序</h3><ol><li><b>成长(🌱)与出牌(🃏)：</b>${explanations.growth} 支付能量打出法术，各自 Ready。</li><li><b>快速法术(⚡)：</b>${explanations.power}</li><li><b>入侵者：</b>${explanations.invader_plan}</li><li><b>慢速法术(🐢)：</b>结算慢速法术与先天法术。</li><li><b>时间流逝(🌙)：</b>打出的法术进入弃牌，元素与临时效果消失，单位恢复生命；随后全员回顾。</li></ol>
            <h3>地图与单位</h3><p>${explanations.map}</p><p>${explanations.presence}</p><p>${explanations.invaders}</p><p>${explanations.dahan}</p><p>${explanations.blight}</p>
            <h3>范围、目标与元素</h3><p>${explanations.card} 距离从自己的存在或圣地(◎)按相邻土地计算，距离 0 指来源土地本身。聚集将相邻土地单位移入目标；推动将目标单位移到相邻土地。</p><p>${Object.entries(elements).map(([key, value]) => `${elementNames[key]}(${value})`).join("、")}是八种元素。只有满足先天法术阈值，才能使用对应效果；元素不会被消耗。</p>
            <h3>入门模式</h3><p>提供四位低复杂度精灵，前七次学习力量使用各精灵固定成长序列，用尽后从次级或高级牌库抽四留一。支持基础版 74 张力量牌（16 张专属、36 张次级、22 张高级）及基础恐惧牌；取得高级力量须遗忘一张。采用固定示例岛板组合：单人 A，双人 A/C，三人 B/C/D，四人 A/B/C/D。没有对手、剧情、事件、扩展精灵或荒芜卡。原创示意地图以 Adjacent 列表和连线表达规则上的相邻关系。</p>
            <h3>操作与回顾</h3><p>${explanations.choice}</p><p>${explanations.confirm}</p><p>${explanations.next} 图标支持鼠标悬停说明，手机轻点后浮动提示会在 3 秒后消失。Help 与 Explain 可随时打开，Esc 关闭对话框或取消选择。</p>`);
    }
    function elementHTML(value) {
        const list = Array.isArray(value) ? value : Object.entries(value || {}).flatMap(([key, amount]) => Array.from({length: amount}, () => key));
        return list.map(key => icon(elements[key] || esc(key), `${elementNames[key] || key}元素 (${elements[key] || key})`)).join("");
    }
    const compactCount = count => Number(count) > 9 ? "9+" : count;
    function thresholdHTML(required, description = "") {
        const current = me()?.elements || {};
        const met = Object.entries(required || {}).every(([key, count]) => (current[key] || 0) >= count);
        return `<div class="si-threshold ${met ? "is-met" : ""}"><span class="si-threshold-elements">${Object.entries(required || {}).map(([key, count]) => icon(`${elements[key] || esc(key)}${count}`, `${elementNames[key] || key}(${elements[key] || key}) 需要 ${count}，本轮拥有 ${current[key] || 0}`)).join(" ")}</span><span>${esc(description)}</span><small>${met ? "✓ Met" : "Not met"}</small></div>`;
    }
    function targetText(card) {
        if (["spirit", "other_spirit", "another_spirit"].includes(card.target)) return card.target === "spirit" ? "精灵" : "另一位精灵";
        const filters = card.target_filter || {};
        const parts = [card.sacred_site ? "圣地(◎)" : "存在(●)", `距离 ${card.range ?? 0}`];
        if (card.source_terrain) parts.push(`来源 ${terrain[card.source_terrain]?.name || card.source_terrain}`);
        if (filters.terrains) parts.push(filters.terrains.map(key => terrain[key]?.name || key).join("／"));
        if (filters.terrain) parts.push((Array.isArray(filters.terrain) ? filters.terrain : [filters.terrain]).map(key => terrain[key]?.name || key).join("／"));
        if (filters.coastal) parts.push("海岸(🌊)");
        if (filters.dahan) parts.push("有达汉(🛖)");
        if (filters.blight) parts.push("有荒芜(☠️)");
        if (filters.no_blight) parts.push("无荒芜(☠️)");
        if (filters.invaders) parts.push("有入侵者");
        return parts.join(" · ");
    }
    function terrainLabel(key) { if (key === "coastal") return "🌊 海岸"; return terrain[key] ? `${terrain[key].icon} ${terrain[key].name}` : esc(key); }
    function landDescription(land) {
        const t = terrain[land.terrain] || {name: land.terrain, icon: "🏝️"};
        const pieces = [`${land.id} · ${t.name}(${t.icon})${land.coastal ? " · 海岸(🌊)" : ""}`, `探索者(🚶) ${land.explorers || 0} · 村镇(🏘️) ${land.towns || 0} · 城市(🏙️) ${land.cities || 0}`, `达汉(🛖) ${land.dahan || 0} · 荒芜(☠️) ${land.blight || 0} · 防御(🛡️) ${land.defend || 0}`];
        for (const [id, count] of Object.entries(land.presence || {})) if (count) pieces.push(`${pname(id)} 存在(●) ${count}${land.sacred_sites?.includes(id) || count > 1 ? "／圣地(◎)" : ""}`);
        pieces.push(`Adjacent: ${(land.adjacent || []).join(" · ") || "—"}`); return pieces.join("；");
    }
    function mapCoordinates(land) {
        const positions = [[58, 74], [180, 60], [302, 74], [60, 178], [180, 164], [300, 178], [118, 274], [244, 274]];
        return positions[(Number(land.number) - 1 + 8) % 8];
    }
    function boardHTML(board) {
        const boardLands = lands().filter(land => land.board === board);
        const legal = new Set(options().filter(option => !selectedCard || !optionCard(option) || optionCard(option) === selectedCard).map(optionLand).filter(Boolean));
        const selected = lands().find(land => land.id === selectedLand);
        return `<div class="si-island-board"><div class="si-board-label">${esc(board)} <span>ISLAND</span></div><svg class="si-island" viewBox="0 0 362 334" role="group" aria-label="Island ${esc(board)}">
            <path class="si-ocean-ripple" d="M18 45Q58 5 117 25Q197-9 274 21Q354 22 354 96Q377 158 344 217Q331 310 250 324Q169 344 103 314Q25 305 18 224Q-7 158 18 110Z"/>
            <path class="si-island-coast" d="M29 53Q62 15 121 34Q196 6 265 31Q341 28 342 101Q365 158 332 214Q322 298 248 314Q168 328 107 304Q37 298 29 220Q5 158 29 113Z"/>
            ${boardLands.flatMap(land => (land.adjacent || []).filter(id => land.id < id).map(id => { const other = boardLands.find(item => item.id === id); if (!other) return ""; const a = mapCoordinates(land), b = mapCoordinates(other); return `<line class="si-adjacency ${selectedLand && (land.id === selectedLand || id === selectedLand) ? "is-adjacent" : ""}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; })).join("")}
            ${boardLands.map(land => {
                const [x, y] = mapCoordinates(land), t = terrain[land.terrain] || terrain.jungle;
                const presence = Object.entries(land.presence || {}).filter(([, count]) => count > 0);
                const isAdjacent = selected?.adjacent?.includes(land.id);
                const troops = [["🚶", land.explorers], ["🏘️", land.towns], ["🏙️", land.cities]].filter(([, count]) => count);
                return `<g transform="translate(${x},${y})" class="si-land ${selectedLand === land.id ? "is-selected" : ""} ${legal.has(land.id) ? "is-legal" : ""} ${isAdjacent ? "is-adjacent" : ""}" role="button" tabindex="0" data-si-land="${esc(land.id)}" data-si-explain="map" data-si-tip="${esc(landDescription(land))}" aria-label="${esc(landDescription(land))}" aria-pressed="${selectedLand === land.id}">
                    <rect class="si-land-ground" x="-50" y="-43" width="100" height="89" rx="19" fill="${t.color}"/>
                    <path d="M-47-17Q-20-32 7-13T47-20" fill="none" stroke="${t.shade}" opacity=".5" stroke-width="2"/>
                    <text class="si-land-number" x="-38" y="-26">${esc(land.id)}</text><text class="si-land-terrain" x="31" y="-24">${t.icon}</text>
                    <text class="si-land-pieces" y="-3">${troops.length ? troops.map(([emoji, count]) => `${emoji}${compactCount(count)}`).join(" ") : "·"}</text>
                    <text class="si-land-pieces si-land-natural" y="16">${[["🛖", land.dahan], ["☠️", land.blight], ["🛡️", land.defend]].filter(([, count]) => count).map(([emoji, count]) => `${emoji}${compactCount(count)}`).join(" ") || "—"}</text>
                    ${presence.map(([id, count], index) => { const px = (index - (presence.length - 1) / 2) * 20; return `<circle cx="${px}" cy="33" r="8" fill="${pcolor(id)}" stroke="${land.sacred_sites?.includes(id) || count > 1 ? "#fff7da" : "#263e38"}" stroke-width="${land.sacred_sites?.includes(id) || count > 1 ? 2.5 : 1}"/><text class="si-presence-number" x="${px}" y="36">${compactCount(count)}</text>`; }).join("")}
                    ${land.coastal ? '<path d="M-9-28q4-4 8 0t8 0" stroke="#397b94" fill="none" stroke-width="2"/>' : ""}
                </g>`;
            }).join("")}</svg></div>`;
    }
    function mapHTML() {
        const boardList = boards();
        if (!boardList.length) return '<div class="si-map-empty"><span>🏝️</span><p>精灵苏醒，守护岛屿。</p></div>';
        const shown = activeBoard === "all" ? boardList : boardList.filter(board => String(board) === String(activeBoard));
        const crossEdges = selectedLand ? (lands().find(land => land.id === selectedLand)?.adjacent || []).filter(id => lands().find(land => land.id === id)?.board !== lands().find(land => land.id === selectedLand)?.board) : [];
        return `<section class="si-map-section"><div class="si-section-head"><h3>🏝️ 岛屿</h3><div class="si-board-tabs">${!narrow && boardList.length > 1 ? button("All", "board", "map", false, `data-board="all" class="${activeBoard === "all" ? "is-active" : ""}"`) : ""}${boardList.map(board => button(esc(board), "board", "map", false, `data-board="${esc(board)}" class="${String(activeBoard) === String(board) ? "is-active" : ""}"`)).join("")}${info("map")}</div></div>
            <div class="si-map-boards ${shown.length > 1 ? "has-multiple" : ""}">${shown.map(boardHTML).join("")}</div>
            <div class="si-map-caption">${icon("┄", "虚线表示相邻土地；点击土地可在 Adjacent 查看完整列表。")} Adjacent${crossEdges.length ? ` · 跨岛相邻：${crossEdges.map(id => button(esc(id), "land-link", "map", false, `data-land="${esc(id)}"`)).join("")}` : ""}<span>${icon("●", explanations.presence)} 存在 · ${icon("◎", explanations.presence)} 圣地</span></div>
            ${landDetailHTML()}</section>`;
    }
    function woundHTML(land) {
        const health = {explorer: 1, town: 2, city: 3, dahan: 2};
        const labels = {explorer: "🚶 探索者", town: "🏘️ 村镇", city: "🏙️ 城市", dahan: "🛖 达汉"};
        const wounded = (land.pieces || []).filter(piece => piece.health < health[piece.type]);
        return wounded.length ? `<div class="si-wounds">${wounded.map(piece => `<span>${labels[piece.type] || esc(piece.type)} · ♥ ${piece.health}/${health[piece.type]}</span>`).join("")}</div>` : "";
    }
    function landDetailHTML() {
        const land = lands().find(item => item.id === selectedLand);
        if (!land) return `<div class="si-land-detail si-muted">Select a land to inspect · ${options().some(option => optionLand(option)) ? "金色边框标示合法目标" : "点击土地查看单位与相邻关系"}</div>`;
        return `<div class="si-land-detail"><div class="si-section-head"><strong>${esc(land.id)} · ${terrainLabel(land.terrain)}</strong><span>${land.coastal ? "🌊 海岸" : "内陆"}</span></div><div class="si-detail-pieces">${[["🚶", "探索者", land.explorers, "invaders"], ["🏘️", "村镇", land.towns, "invaders"], ["🏙️", "城市", land.cities, "invaders"], ["🛖", "达汉", land.dahan, "dahan"], ["☠️", "荒芜", land.blight, "blight"], ["🛡️", "防御", land.defend, "dahan"]].map(([emoji, label, count, explanation]) => icon(`${emoji} ${label} <b>${count || 0}</b>`, explanations[explanation])).join("")}</div>${woundHTML(land)}<div class="si-land-links"><span>Adjacent</span>${(land.adjacent || []).map(id => button(esc(id), "land-link", "map", false, `data-land="${esc(id)}"`)).join("")}</div></div>`;
    }
    function invaderCardHTML(key, label, emoji) {
        const card = view?.invaders?.[key];
        return `<div class="si-invader-card ${key}" data-si-tip="${esc(explanations.invader_plan)}" tabindex="0"><span class="si-invader-caption">${emoji} ${label}</span>${card ? `<strong>${(card.terrains || []).map(terrainLabel).join(" · ") || esc(card.name)}</strong><small>${card.coastal ? "🌊 海岸" : ""} Stage ${esc(card.stage ?? "—")}</small>` : '<strong class="si-muted">—</strong><small>无行动</small>'}</div>`;
    }
    function overviewHTML() {
        const fear = view.fear || {}, blight = view.blight || {};
        const fearMax = Number(fear.pool) || players().length * 4, generated = Number(fear.generated) || 0;
        return `<div class="si-overview"><div class="si-fear" data-si-explain="fear"><div class="si-section-head"><span>${icon("👁️", explanations.fear)} 恐惧 <b>${generated} / ${fearMax}</b></span><span>等级 ${["I", "II", "III"][(fear.terror_level || 1) - 1] || fear.terror_level || "I"}</span></div><div class="si-meter"><i style="width:${Math.min(100, generated / fearMax * 100)}%"></i></div><small>待结算 ${fear.earned || 0} · 牌库 ${fear.deck_remaining ?? "—"}</small></div><div class="si-blight" data-si-explain="blight">${icon("☠️", explanations.blight)}<span>荒芜供应<strong>${blight.remaining ?? "—"}<small> / ${blight.total ?? "—"}</small></strong></span></div><div class="si-invader-line">${invaderCardHTML("ravage", "蹂躏", "⚔️")}${invaderCardHTML("build", "建造", "🏘️")}${invaderCardHTML("explore", "探索", "🚶")}</div></div>`;
    }
    function playersHTML() {
        return `<div class="si-team">${players().map((player, index) => { const s = spirit(player.spirit_id); const ready = (view.ready_players || []).includes(pid(player)) || player.ready; return `<div class="si-player ${pid(player) === view.you ? "is-me" : ""}" style="--player-color:${colors[index % colors.length]}"><span class="si-player-dot" data-si-tip="${esc(`${index + 1} · ${player.name} 的存在(●)颜色`)}">${index + 1}</span><div><strong>${esc(player.name)} ${pid(player) === view.you ? '<span class="si-you">You</span>' : ""}</strong><small>${esc(s?.name || player.spirit_name || "选择精灵")}</small></div><span class="si-player-resource">${player.spirit_id ? `${icon("⚡", "能量(⚡)：支付法术费用的资源")} ${player.energy ?? 0}` : "—"}${ready ? '<small>✓ Ready</small>' : ""}</span></div>`; }).join("")}</div>`;
    }
    function trackHTML(label, values, progress) {
        if (!Array.isArray(values)) return `<div class="si-track"><span>${icon(label, label === "⚡" ? "能量(⚡)轨道：每轮收入" : "出牌(🃏)轨道：每轮最多可打出的法术数")}</span><b>${esc(values ?? progress ?? "—")}</b></div>`;
        const index = Number(progress) || 0;
        return `<div class="si-track"><span>${icon(label, label === "⚡" ? "能量(⚡)轨道：每轮收入" : "出牌(🃏)轨道：每轮最多可打出的法术数")}</span><div>${values.map((value, i) => `<span class="${i <= index ? "is-unlocked" : ""} ${i === index ? "is-current" : ""}" data-si-tip="${esc(`${i <= index ? "已解锁" : "未解锁"}：${typeof value === "object" ? JSON.stringify(value) : value}`)}">${typeof value === "object" ? esc(value.value ?? value.energy ?? value.plays ?? "●") : esc(value)}</span>`).join("")}</div></div>`;
    }
    function spiritHTML() {
        const player = me(), spec = spirit(player?.spirit_id);
        if (!spec) return "";
        const energyTrack = spec.energy_track || [], playTrack = spec.plays_track || [];
        const innate = Array.isArray(spec.innate) ? spec.innate : [spec.innate].filter(Boolean);
        return `<section class="si-box si-spirit"><div class="si-section-head"><div><span class="si-eyebrow">YOUR SPIRIT</span><h3>${esc(spec.name)}</h3></div><span class="si-energy">${icon("⚡", "能量(⚡)：支付法术费用的资源")} ${player.energy || 0}</span></div><div class="si-tracks" data-si-explain="tracks">${trackHTML("⚡", energyTrack, player.energy_track)}${trackHTML("🃏", playTrack, player.plays_track)}</div><div class="si-spirit-elements">${elementHTML(player.elements || {})}</div><details data-si-details ${spiritDetailsOpen ? "open" : ""}><summary>精灵能力 <span>⌄</span></summary><p>${esc(spec.special || spec.special_rule || "")}</p>${innate.map(item => `<h4>${esc(item.name)}</h4><p class="si-innate-meta">${item.speed === "fast" ? "⚡ 快速" : "🐢 慢速"} · ${esc(targetText(item))}${player.innate_used ? " · Used" : ""}</p>${(item.thresholds || []).map(level => thresholdHTML(level.elements, level.description)).join("") || `<p>${esc(item.description || item.text || "")}</p>`}`).join("")}</details></section>`;
    }
    function spiritChoiceHTML() {
        return `<div class="si-spirit-choices">${spirits().map((spec, index) => { const option = options().find(item => item.spirit_id === spec.id || item.action?.spirit_id === spec.id); const chosen = players().find(player => player.spirit_id === spec.id); const selected = selectedOption !== null && options()[selectedOption] === option; return button(`<span class="si-spirit-art si-spirit-art-${index}" data-si-tip="${esc(`${spec.name}：${spec.special || ""}`)}">${["⚡", "🌊", "⛰️", "🌒"][index] || "✨"}</span><span class="si-eyebrow">${esc(spec.name_en || "SPIRIT")}</span><strong>${esc(spec.name)}</strong><span class="si-spirit-description">${esc(spec.special || spec.special_rule || "")}</span><small>${chosen ? `已选择 · ${esc(chosen.name)}` : "Select spirit"}</small>`, "option", "spirit", !option || pending, `class="si-spirit-choice ${selected ? "is-selected" : ""}" data-option="${options().indexOf(option)}" data-si-detail="${esc(`${spec.name}：${spec.special || ""} 先天法术 ${spec.innate?.name || ""}：${spec.innate?.description || ""} ${explanations.spirit}`)}"`); }).join("")}</div>`;
    }
    function cardHTML(card) {
        if (typeof card === "string") card = {id: card, name: card};
        const related = options().some(option => optionCard(option) === card.id), speed = card.speed === "fast" ? "⚡" : "🐢";
        return button(`<span class="si-power-head"><span class="si-power-speed">${icon(speed, `${card.speed === "fast" ? "快速法术(⚡)" : "慢速法术(🐢)"}：在对应阶段结算`)}</span><span class="si-power-cost">${icon("⚡", "法术费用：打出时支付此数目的能量(⚡)")} ${card.cost ?? 0}</span></span><strong>${esc(cardName(card))}</strong><span class="si-power-elements">${elementHTML(card.elements)}</span><span class="si-power-text">${esc(card.text || card.description || "")}</span><span class="si-power-footer">${esc(targetText(card))}</span>`, "card", "card", false, `class="si-power-card ${card.speed === "fast" ? "is-fast" : "is-slow"} ${related ? "is-playable" : ""} ${selectedCard === card.id ? "is-selected" : ""}" data-card="${esc(card.id)}" aria-pressed="${selectedCard === card.id}"`);
    }
    function handHTML() {
        const player = me(); if (!player?.spirit_id) return "";
        const cards = player[cardTab] || [];
        const choices = view.choice_cards || [];
        return `<section class="si-box si-hand"><div class="si-section-head"><h3>🃏 法术</h3><div class="si-card-tabs">${[["hand", "Hand"], ["played", "Played"], ["discard", "Discard"]].map(([key, label]) => button(`${label} <b>${player[key]?.length || 0}</b>`, "card-tab", "card", false, `data-tab="${key}" class="${cardTab === key ? "is-active" : ""}"`)).join("")}</div></div>${choices.length ? `<div class="si-choice-cards"><span class="si-eyebrow">CHOOSE A POWER</span><div class="si-power-grid">${choices.map(cardHTML).join("")}</div></div>` : ""}<div class="si-power-grid">${cards.map(cardHTML).join("") || '<p class="si-muted">No cards here.</p>'}</div></section>`;
    }
    function actionHTML() {
        const currentOption = selectedOption === null ? null : options()[selectedOption];
        let filtered = options().map((option, index) => ({option, index}));
        if (selectedCard && filtered.some(({option}) => optionCard(option) === selectedCard)) filtered = filtered.filter(({option}) => optionCard(option) === selectedCard || !optionCard(option));
        if (selectedLand && filtered.some(({option}) => optionLand(option) === selectedLand)) filtered = filtered.filter(({option}) => optionLand(option) === selectedLand || !optionLand(option));
        const card = selectedCard ? findCard(selectedCard) : null;
        const roundEnd = view.phase === "round_end", over = view.phase === "game_over" || view.game_over;
        const nextOption = options().find(option => option.action?.type === "next_round");
        let prompt = view.pending?.prompt || (view.current_turn && view.current_turn !== view.you ? `Waiting for ${pname(view.current_turn)}` : "选择一个可执行动作。");
        if (!options().length && !view.pending) prompt = over ? view.result?.reason || view.result || view.outcome || "守护之战已经结束。" : "Waiting for other spirits";
        return `<section class="si-box si-actions"><div class="si-section-head"><h3>${roundEnd ? "🌙 本轮回顾" : over ? "🏝️ 游戏结果" : "Action"}</h3>${info(roundEnd ? "next" : "choice")}</div>
            <p class="si-action-prompt" role="status">${pending ? "Sending…" : esc(typeof prompt === "object" ? prompt.reason || prompt.message || "Game over" : prompt)}</p>
            ${card ? `<div class="si-selected-card"><strong>${esc(cardName(card))}</strong><p>${esc(card.text || card.description || "")}</p><small>${card.speed === "fast" ? "⚡ 快速" : "🐢 慢速"} · 能量 ${card.cost ?? 0} · ${esc(targetText(card))}</small>${Object.keys(card.threshold || {}).length ? thresholdHTML(card.threshold, "达到门槛时追加牌面效果") : ""}</div>` : ""}
            ${roundEnd ? `<p class="si-muted">${(view.ready_players || []).length} / ${players().length} ready</p>${button(nextOption ? "Next Round" : "✓ Ready", "next", "next", !nextOption || pending, 'class="si-primary si-next"')}<p class="si-muted">Waiting: ${players().filter(player => !(view.ready_players || []).includes(pid(player))).map(player => esc(player.name)).join(" · ") || "—"}</p>` : `<div class="si-option-list">${filtered.filter(({option}) => view.phase !== "choose_spirit" || !option.spirit_id).map(({option, index}) => button(`${optionLand(option) ? `<span class="si-option-land">${esc(optionLand(option))}</span>` : ""}<span>${esc(option.label || option.action?.type || "Choose")}</span>`, "option", optionExplain(option), pending, `data-option="${index}" class="si-option ${selectedOption === index ? "is-selected" : ""}" aria-pressed="${selectedOption === index}"`)).join("") || (!over && view.phase !== "choose_spirit" ? '<p class="si-muted">No available actions.</p>' : "")}</div>${!over ? `<div class="si-confirm-area">${currentOption ? `<p>${esc(currentOption.label)}</p>` : '<p class="si-muted">Select an option, then confirm.</p>'}${button(pending ? "Sending…" : "Confirm", "confirm", "confirm", !currentOption || pending, 'class="si-primary"')}</div>` : ""}`}
            ${explaining ? '<p class="si-explain-hint">Explain mode · Select an item or press Esc.</p>' : ""}</section>`;
    }
    function fearHTML() {
        const cards = view.fear?.revealed || [];
        if (!cards.length) return "";
        return `<section class="si-box si-fear-revealed"><div class="si-section-head"><h3>👁️ 恐惧牌</h3>${info("fear")}</div>${cards.map(card => `<h4>${esc(card.name)}</h4><p>${esc(card["level" + view.fear.terror_level] || card.description || "")}</p>`).join("")}</section>`;
    }
    function logHTML() {
        const log = (view.log || []).slice(-80).reverse();
        return `<section class="si-box si-log"><div class="si-section-head"><h3>📜 Log</h3>${info("history")}</div><ol>${log.map(entry => `<li>${esc(typeof entry === "string" ? entry : entry.text || entry.message || "")}</li>`).join("") || '<li class="si-muted">精灵即将苏醒。</li>'}</ol></section>`;
    }
    function render() {
        if (!view) return;
        const boardList = boards();
        if ((narrow && activeBoard === "all") || (activeBoard !== "all" && !boardList.includes(activeBoard))) activeBoard = me()?.board || boardList[0] || "all";
        const over = view.phase === "game_over" || view.game_over;
        panel.innerHTML = `<div class="si-shell"><div class="si-top"><div><span class="si-eyebrow">SPIRIT ISLAND · COOPERATIVE</span><h2>灵迹岛 <span>Spirit Island</span></h2></div><div class="si-round-badge"><span>ROUND ${view.round || 1}</span><strong>${esc(phaseNames[view.phase] || view.phase || "")}</strong></div></div>
            ${playersHTML()}${overviewHTML()}
            ${view.phase !== "choose_spirit" ? `<div class="si-phase-bar">${phaseSteps.map(([key, emoji, label]) => `<span class="${view.phase === key ? "is-active" : ""}" data-si-tip="${esc(`${label}(${emoji})：${key === "round_end" ? explanations.next : key === "growth" ? explanations.growth : ["fear", "ravage", "build", "explore"].includes(key) ? explanations.invader_plan : key === "play" ? explanations.card : explanations.power}`)}" tabindex="0">${emoji}<small>${label}</small></span>`).join("")}</div>` : ""}
            ${over ? `<div class="si-result-banner">${view.victory || view.won || view.result?.victory ? "🌿 岛屿重获安宁" : view.victory === false ? "☠️ 岛屿失守" : "🏝️ 守护之战结束"}<span>${esc(view.end_reason || view.result?.reason || "请查看最终地图与日志。")}</span></div>` : ""}
            <div class="si-layout show-${mobileTab}">${view.phase !== "choose_spirit" ? `<div class="si-mobile-tabs">${button("🏝️ Island", "mobile-tab", "map", false, `data-tab="island" class="${mobileTab === "island" ? "is-active" : ""}"`)}${button(`🃏 Powers · ${me()?.hand?.length || 0} / ${me()?.played?.length || 0}`, "mobile-tab", "card", false, `data-tab="powers" class="${mobileTab === "powers" ? "is-active" : ""}"`)}</div>` : ""}<div class="si-main">${view.phase === "choose_spirit" ? spiritChoiceHTML() : mapHTML()}${handHTML()}</div><aside class="si-sidebar">${spiritHTML()}${actionHTML()}${fearHTML()}${logHTML()}</aside></div>
            <p class="si-footer">INTRODUCTORY GAME · ${players().length} SPIRIT${players().length === 1 ? "" : "S"} · 原创示意地图 · ${icon("🚶 🏘️ 🏙️", explanations.invaders)} ${icon("🛖", explanations.dahan)} ${icon("☠️", explanations.blight)}</p></div>`;
        panel.classList.toggle("is-explaining", explaining);
    }
    function chooseLand(id) {
        const land = lands().find(item => item.id === id); if (!land) return;
        selectedLand = selectedLand === id ? null : id; selectedOption = null;
        if (activeBoard !== "all" && selectedLand) activeBoard = land.board;
        const matching = options().map((option, index) => ({option, index})).filter(({option}) => optionLand(option) === selectedLand && (!selectedCard || !optionCard(option) || optionCard(option) === selectedCard));
        if (matching.length === 1) selectedOption = matching[0].index;
        render(); if (inputKind === "touch") showTip(landDescription(land), panel, true);
    }
    panel.addEventListener("click", event => {
        if (!view) return;
        const iconTarget = event.target.closest(".si-icon[data-si-tip]");
        if (iconTarget && inputKind === "touch") { showTip(iconTarget.dataset.siTip, iconTarget, true); return; }
        const landTarget = event.target.closest("[data-si-land]");
        if (landTarget) { chooseLand(landTarget.dataset.siLand); return; }
        const target = event.target.closest("[data-si-action]");
        if (!target) {
            const tipTarget = event.target.closest("[data-si-tip]");
            if (tipTarget && inputKind === "touch") { showTip(tipTarget.dataset.siTip, tipTarget, true); return; }
            if (!event.target.closest("button,input,select,summary,details,.si-land-detail,.si-selected-card,.si-option-list")) { resetSelection(); render(); }
            return;
        }
        if (target.disabled) return;
        const action = target.dataset.siAction;
        if (action === "option") { selectedOption = Number(target.dataset.option); const option = options()[selectedOption]; if (optionLand(option)) selectedLand = optionLand(option); selectedCard = optionCard(option); render(); }
        else if (action === "confirm") submit(options()[selectedOption]);
        else if (action === "next") submit(options().find(option => option.action?.type === "next_round"));
        else if (action === "card") { selectedCard = selectedCard === target.dataset.card ? null : target.dataset.card; selectedOption = null; selectedLand = null; const matching = options().map((option, index) => ({option, index})).filter(({option}) => optionCard(option) === selectedCard); if (matching.length === 1) selectedOption = matching[0].index; render(); }
        else if (action === "card-tab") { cardTab = target.dataset.tab; selectedCard = null; selectedOption = null; render(); }
        else if (action === "mobile-tab") { mobileTab = target.dataset.tab; render(); }
        else if (action === "board") { activeBoard = target.dataset.board; render(); }
        else if (action === "land-link") { const land = lands().find(item => item.id === target.dataset.land); if (land && activeBoard !== "all") activeBoard = land.board; chooseLand(target.dataset.land); }
        else if (action === "info") { setExplain(false); openDialog("Explain", `<p>${esc(explanations[target.dataset.siExplain])}</p>`); }
        const tipTarget = event.target.closest("[data-si-tip]");
        if (inputKind === "touch" && tipTarget?.isConnected && action !== "info") showTip(tipTarget.dataset.siTip, tipTarget, true);
    });
    panel.addEventListener("toggle", event => { if (event.target.matches("[data-si-details]")) spiritDetailsOpen = event.target.open; }, true);
    panel.addEventListener("keydown", event => {
        const land = event.target.closest("[data-si-land]");
        if (land && ["Enter", " "].includes(event.key)) { event.preventDefault(); land.dispatchEvent(new MouseEvent("click", {bubbles: true})); }
    });
    document.addEventListener("pointerdown", event => {
        inputKind = event.pointerType || "mouse";
        if (!explaining || !view || [helpButton, explainButton, dialogClose].some(element => element === event.target || element.contains(event.target))) return;
        let target = event.target.closest("[data-si-explain]");
        if (!target) target = [...panel.querySelectorAll("[data-si-explain]")].filter(element => element.tagName === "BUTTON").find(element => { const rect = element.getBoundingClientRect(); return rect.width && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom; });
        event.preventDefault(); event.stopImmediatePropagation();
        suppressed = {x: event.clientX, y: event.clientY, until: Date.now() + 900};
        if (target) { const explanation = target.dataset.siDetail || explanations[target.dataset.siExplain] || explanations.choice; setExplain(false); openDialog("Explain", `<p>${esc(explanation)}</p>`); }
    }, true);
    document.addEventListener("click", event => {
        if (suppressed && Date.now() < suppressed.until && Math.abs(event.clientX - suppressed.x) < 6 && Math.abs(event.clientY - suppressed.y) < 6) { event.preventDefault(); event.stopImmediatePropagation(); suppressed = null; return; }
        if (!explaining || !view || [helpButton, explainButton, dialogClose].some(element => element === event.target || element.contains(event.target))) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const target = event.target.closest("[data-si-explain]");
        if (target) { setExplain(false); openDialog("Explain", `<p>${esc(target.dataset.siDetail || explanations[target.dataset.siExplain] || explanations.choice)}</p>`); }
    }, true);
    document.addEventListener("keydown", event => {
        if (!view) return;
        if (event.key === "Escape") { hideTip(); if (explaining) { event.preventDefault(); setExplain(false); render(); } else if (!dialog.open) { resetSelection(); render(); } }
        else if (explaining && ["Enter", " "].includes(event.key) && event.target.matches("input,select,textarea,summary")) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    panel.addEventListener("pointerover", event => { const target = event.target.closest("[data-si-tip]"); if (target && event.pointerType !== "touch" && !explaining) showTip(target.dataset.siTip, target); });
    panel.addEventListener("pointerout", event => { if (event.pointerType !== "touch") hideTip(); });
    panel.addEventListener("focusin", event => { const target = event.target.closest("[data-si-tip]"); if (target && !explaining && inputKind !== "touch") showTip(target.dataset.siTip, target); });
    panel.addEventListener("focusout", hideTip);
    helpButton.addEventListener("click", showHelp);
    explainButton.addEventListener("click", () => { setExplain(!explaining); render(); });
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { hideTip(); if (returnFocus?.isConnected) returnFocus.focus(); });
    dialog.addEventListener("click", event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
    window.addEventListener("resize", () => { hideTip(); const nextNarrow = window.innerWidth < 720; if (narrow !== nextNarrow) { narrow = nextNarrow; activeBoard = me()?.board || boards()[0] || "home"; render(); } });
    function clearState() {
        view = null; lastSignature = ""; resetSelection(); pending = false; setExplain(false); hideTip(); window.clearTimeout(pendingTimer);
        if (dialog.open) dialog.close(); panel.innerHTML = ""; cardTab = "hand"; mobileTab = "island"; spiritDetailsOpen = false; activeBoard = "home";
    }
    window.renderSpiritIslandGameState = data => {
        if (!data?.view) return;
        const next = data.view;
        const signature = JSON.stringify([next.game_instance_id, next.round, next.phase, next.pending, next.action_options]);
        if (signature !== lastSignature) resetSelection();
        if (view?.game_instance_id !== next.game_instance_id) { cardTab = "hand"; activeBoard = next.players?.find(player => pid(player) === next.you)?.board || next.lands?.[0]?.board || "home"; if (dialog.open) dialog.close(); }
        if (view?.phase !== next.phase && ["fast", "slow"].includes(next.phase)) { cardTab = "played"; mobileTab = "powers"; }
        if (view?.phase !== next.phase && ["growth", "play"].includes(next.phase)) { cardTab = "hand"; mobileTab = next.phase === "play" ? "powers" : "island"; }
        if (next.pending && signature !== lastSignature) { if ((next.action_options || []).some(option => optionLand(option))) mobileTab = "island"; else if (next.choice_cards?.length) mobileTab = "powers"; }
        view = next; lastSignature = signature; pending = false; window.clearTimeout(pendingTimer); render();
    };
    window.showSpiritIslandHeaderActions = visible => { header.style.display = visible ? "flex" : "none"; if (!visible) clearState(); };
    window.clearSpiritIslandState = clearState;
    window.addEventListener("DOMContentLoaded", () => { if (typeof socket !== "undefined") socket.on("system:error", () => { if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); } }); }, {once: true});
})();
