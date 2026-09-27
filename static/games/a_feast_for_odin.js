(() => {
    "use strict";
    const panel = document.getElementById("odinPanel");
    const root = document.getElementById("odinRoot");
    const header = document.getElementById("odinHeaderActions");
    const help = document.getElementById("odinHelpBtn");
    const explain = document.getElementById("odinExplainBtn");
    const dialog = document.getElementById("odinDialog");
    const tip = document.getElementById("odinTip");
    const colors = {orange:"#cb8c36", red:"#b55e55", green:"#519677", blue:"#538fa7", silver:"#899fa4", ore:"#526d85", wood:"#92724d", stone:"#818580"};
    const playerColors = ["#d6b367", "#7ec4b3", "#8fadd9", "#cc96ac"];
    const groups = {build:"🏠 建造", hunt:"🏹 狩猎", market:"🌾 生产", craft:"🔨 工艺", trade:"🔄 交易", sail:"⛵ 航海", occupation:"📜 职业"};
    const phases = {action:"行动阶段", prepare:"准备收入", feast:"宴会", round_end:"本轮回顾", final_placement:"最终摆放", game_over:"终局"};
    const explanations = {
        home:"家园(🏡)：可放绿色货物(🟩)、蓝色货物(🟦)、矿石(🔷)和银币(🪙)。不同绿块不能正交相邻。每个未盖 −1 格扣 1 分；空白格不扣分。",
        income:"收入(🪙)：每条收入轨最小未盖数字即本轮收入。覆盖数字时，它左下的整个区域必须已填满，奖励图标视作已填。末轮收入正常发到库存，计分时不重复加一次。",
        bonus:"包围奖励(🎁)：图标周围八方向的现有格都盖满后，每轮宴会后获得奖励。边缘只检查存在的格。盖掉图标会失去奖励；末轮没有奖励。",
        house:"房屋(🏠)：接受橙(🟧)、红(🟥)、绿(🟩)、蓝(🟦)货物及银币(🪙)，不接受矿石(🔷)。不同橙块不能邻接，红块同理；绿色可相邻。长屋的柱子不能盖。棚屋储存木材(🪵)与石头(🪨)。",
        workers:"工人(🧑‍🌾)：每轮加 1 名；行动花费 1–4 名。同一行动格一轮只可占用一次。三工人列先抽职业(📜)；四工人列可在行动前或后打出一张职业。最后放工人的玩家下轮先手。",
        ships:"船只：捕鲸艇(🛶)3 银币、商船(⛵)5 银币、长船(🚢)8 银币，可随时购买。船坞最多 3 小船、4 大船。行动外可把矿石(🔷)装船，捕鲸艇限 1 额外矿，长船限 3。船不因普通行动消耗。",
        migration:"移民(🧳)：支付当前轮数的银币(🪙)，将一艘商船(⛵)或长船(🚢)翻面；失去这艘船及装矿，不失工人。每次永久减少 3 格供餐。商船移民值 18 分，长船值 21 分。",
        feast:"宴会(🍽️)：橙/红食物与银币覆盖桌长；不同橙块不能挨着，红块同理。每种长条食物最多一次横放，其余竖放；正方形方向相同。不可超出桌长。空格每格 −3 分。Auto Feed 自动规划并完成供餐。",
        upgrade:"货物升级(⬆️)：按同尺寸橙→红→绿→蓝，牲畜也可升级。同一组升级中每块最多用一次；新得到的块不能在这一组再次升级。海外贸易需要商船(⛵)，付 1 银币(🪙)，每种绿货至多一块翻蓝。",
        mountain:"山地(⛰️)：从选定条左边连续拿资源，末端 2 银币(🪙)算一项。3+2 等行动必须选择不同山地。每轮末每条移除最左资源并增加一条新山地。",
        dice:"骰子(🎲)：可掷最多 3 次（职业可改变）。狩猎/设陷阱/捕鲸求低，用木材(🪵)或对应武器补足；突袭/劫掠求高，用石头(🪨)或长剑(⚔️)加点。失败获得资源与武器，部分行动退回工人。低骰修正为 0 时必须成功。",
        occupation:"职业(📜)：手牌秘密，打出后公开并生效，只有已打出的牌计分。此版本精选 32 种效果：8 种起始牌各一，24 种后续职业各两张，同名效果叠加。",
        next:"Next Round：确认已查看本轮收入、繁殖、宴会和奖励。所有玩家都确认后进入下一轮；AI 自动确认。",
        ready:"Ready：完成收入前的拼板并锁定；所有人 Ready 后一起发收入。最终摆放阶段用 Finish，所有人完成后才计分。",
        version:"基础机制数字适配：61 个行动格、7/6 轮、单人及 AI。32 种精选职业，未含全部 190 张卡及扩展。岛屿采用矩形轮廓和简化收入轨，特殊板块轮廓与山地序列采用本地数据；保留基础分值/负分总数，非逐格复刻。石屋布局亦为数字适配。",
        placement:"放置：先选库存货物，Rotate 旋转、Flip 镜像，再点棋盘格预览，Confirm 提交。不能越界、重叠或收回。点空白、Cancel 或 Esc 取消；R/F 可旋转/翻转。",
        pass:"Pass：结束本轮工人放置，剩余工人不能再派出。本轮仍可在收入前拼板。",
        end_turn:"End Turn：完成这次主行动，把行动机会交给下一位玩家。",
        score:"分数(⭐)：船、移民、岛屿、房屋、家畜、已打职业、剩余银币和皇冠，减未覆盖负分与宴会罚分。并列共同获胜。显示的是当前预估分数。"
    };
    let view = null, room = null, inspected = null, tab = "home", boardIndex = 0, group = "trade";
    let selectedGood = null, rotation = 0, flipped = false, anchor = null, selectedMove = null;
    let explaining = false, pendingSend = false, tipTimer = null, sendTimer = null, suppressedUntil = 0, restoreFocus = null;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
    const why = key => explanations[key] || key;
    const player = pid => view?.players.find(p => p.player_id === pid);
    const own = () => player(view?.you);
    const name = pid => player(pid)?.name || "—";
    const good = key => view.catalog.goods[key] || view.catalog.weapons[key] || {name:key, icon:"🏠"};
    const goodName = key => `${good(key).name}(${good(key).icon})`;
    const goodText = items => Object.entries(items || {}).filter(([, n]) => n).map(([g, n]) => `${good(g).icon} ${n}`).join(" · ") || "—";
    const fullGoods = items => Object.entries(items || {}).filter(([, n]) => n).map(([g, n]) => `${goodName(g)} ×${n}`).join("，") || "无";
    const moves = type => view.moves.filter(m => m.type === type);
    const pending = () => view.pending[0];
    const button = (label, action, explanation, disabled = false, attrs = "") => `<button type="button" data-od-action="${esc(action)}" data-od-explain="${esc(why(explanation))}" ${disabled || pendingSend ? "disabled" : ""} ${attrs}>${label}</button>`;
    const passive = (label, explanation, cls = "od-token") => `<span tabindex="0" class="${cls}" title="${esc(why(explanation))}" data-od-tip="${esc(why(explanation))}" data-od-explain="${esc(why(explanation))}">${label}</span>`;
    const mini = key => {
        const d = good(key);
        return `<span class="od-mini" aria-hidden="true" style="--mini-cols:${d.width};--mini-rows:${d.height};--od-tile:${colors[d.color]}">${d.cells.map(([x, y]) => `<i style="grid-column:${x+1};grid-row:${y+1}"></i>`).join("")}</span>`;
    };
    const moveIndex = move => view.moves.indexOf(move);
    function effectText(e) {
        if (e.kind === "gain") return goodText(e.items);
        if (e.kind === "exchange") return `${goodText(e.cost)} → ${goodText(e.reward)}`;
        if (e.kind === "choice") return e.options.map(effectText).join(" / ");
        if (e.kind === "ship") return `${goodText(e.cost)} → ${view.catalog.ships[e.ship].icon}`;
        if (e.kind === "build") return `${goodText(e.cost)} → ${view.catalog.boards[e.building].name}`;
        if (e.kind === "mountain") return `⛰️ ${e.counts.join("+")}`;
        if (e.kind === "upgrade") return `${"⬆️".repeat(e.steps)} ${e.count} 份`;
        if (e.kind === "produce") return `${good(e.animal).icon} → ${good(e.good).icon} ${e.fixed || "≤3"}`;
        return {settlement:"🏠 + ⛵ / 🚢", wood_ore:`🪵 ${view.players.length} + 🔷 1`, forge:"🔷 1 → 🔨 奇珍", overseas:"🪙 1 · 🟩 → 🟦", special_sale:"🪙 → 奇珍 ≤2", hunt:`🎲 ${({hunt:"狩猎", snare:"设陷阱", whale:"捕鲸", raid:"突袭", pillage:"劫掠"})[e.mode]}`, explore:`🧭 ${e.tier} 级探索`, emigrate:`🪙 ${view.round} → 🧳`, convert_whaler:"🛶 → ⛵", draw:`📜 +${e.count}`, occupation:`📜 打出 ≤${e.count}`, paid_occupation:"🪨 / 🔷 → 📜 + 🪙", weapons:`⚔️ +${e.count}`, timing:"📜 职业时机"}[e.kind] || e.kind;
    }
    function actionExplanation(key) {
        const a = view.catalog.actions[key];
        const context = {build:"ships", hunt:"dice", market:"feast", craft:"upgrade", trade:"upgrade", sail:"ships", occupation:"occupation"}[a.group];
        return `${a.name}：花费 ${a.workers} 工人(🧑‍🌾)。${a.effects.map(effectText).join("；")}。${a.ship ? `需要${view.catalog.ships[a.ship].name}(${view.catalog.ships[a.ship].icon}) ${a.ships || 1} 艘。` : ""}${why(context)}${a.workers === 3 ? " 三工人列先抽一张职业(📜)。" : a.workers === 4 ? " 四工人列可前后打出一张职业(📜)。" : ""}`;
    }
    function moveText(m) {
        const p = own(), e = pending();
        if (m.type === "occupy") return view.catalog.actions[m.copy || m.space].name;
        if (m.type === "accept") return effectText(e);
        if (m.type === "choose") return m.index !== undefined ? effectText(e.options[m.index]) : view.catalog.boards[m.option]?.name || m.option;
        if (m.type === "take_mountain") return `⛰️ ${m.index+1} · 取 ${m.count} 项`;
        if (m.type === "upgrade") return `${good(m.good).icon} ${good(m.good).name} ${"⬆️".repeat(e.steps)}`;
        if (m.type === "take_good") return `${good(m.good).icon} ${good(m.good).name}${e.kind === "special_sale" ? ` · 🪙 ${good(m.good).price}` : ""}`;
        if (m.type === "explore") return `🧭 ${view.catalog.boards[view.islands[m.index].kind].name}`;
        if (m.type === "buy_ship") return `${view.catalog.ships[m.ship].icon} ${view.catalog.ships[m.ship].name} · 🪙 ${view.catalog.ships[m.ship].cost}`;
        if (["arm", "emigrate", "convert_whaler"].includes(m.type)) return `${{arm:"🔷 装矿", emigrate:"🧳 移民", convert_whaler:"⛵ 换成商船"}[m.type]} · ${view.catalog.ships[p.ships[m.index].kind].icon} ${m.index+1}`;
        if (["play_occupation", "tutor"].includes(m.type)) return `📜 ${view.catalog.occupations[m.card.split(":")[0]].name}${m.type === "tutor" ? " · 🪙 1" : ""}`;
        if (m.type === "pay_occupation") return `${good(m.good).icon} 1 → 📜 + 🪙`;
        if (m.type === "timing") return {before:"Play before action", after:"Play after action", skip:"Skip occupation"}[m.option];
        if (m.type === "succeed") return m.good ? `${good(m.good).icon} ${good(m.good).name}` : "Claim rewards";
        if (m.type === "serve") return `${good(m.good).icon} ${good(m.good).name} · ${m.wide ? "横放" : "竖放"} ${m.wide ? Math.max(good(m.good).width, good(m.good).height) : Math.min(good(m.good).width, good(m.good).height)} 格`;
        if (m.type === "store") return `${good(m.good).icon} → ${view.catalog.boards[p.boards[m.board].kind].name}`;
        if (m.type === "profession_trade") return `📜 ${view.catalog.occupations[m.card.split(":")[0]].name} · 交易 ${m.index+1}${m.option ? "（怀孕牛）" : ""}`;
        if (m.type === "shop") return `${good(m.good).icon} ⬆️ · 🪙 1`;
        return {pass:"Pass", end_turn:"End Turn", ready:view.phase === "final_placement" ? "Finish" : "Ready", next_round:"Next Round", skip:"Skip", reroll:"Roll again", fail:"Take compensation", serve_gap:"Leave a gap (−3⭐)", auto_feast:"Auto Feed", finish_feast:"Finish Feast", no_mead:"No Mead · 🪙 +1"}[m.type] || m.type;
    }
    function moveExplanation(m) {
        if (m.type === "occupy") return actionExplanation(m.copy || m.space);
        if (m.card) return view.catalog.occupations[m.card.split(":")[0]].text;
        const key = {next_round:"next", store:"house", serve:"feast", serve_gap:"feast", auto_feast:"feast", finish_feast:"feast", no_mead:"feast", buy_ship:"ships", arm:"ships", emigrate:"migration", convert_whaler:"ships", take_mountain:"mountain", reroll:"dice", fail:"dice", succeed:"dice", take_good:"upgrade", pay_occupation:"occupation", timing:"occupation"}[m.type] || m.type;
        return `${moveText(m)}。${why(key)}${m.payment ? ` 支付 ${fullGoods(m.payment)}。` : ""}`;
    }
    const moveButton = (m, label = null, attrs = "") => button(esc(label || moveText(m)), `move:${moveIndex(m)}`, moveExplanation(m), false, attrs);
    const familyKey = m => JSON.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => !["revision", "payment"].includes(k))));
    function optionList(list) {
        const unique = new Map();
        list.forEach(m => { if (!unique.has(familyKey(m))) unique.set(familyKey(m), m); });
        return `<div class="od-options">${[...unique.values()].map(m => moveButton(m)).join("")}</div>`;
    }
    function selectionHtml() {
        const m = view.moves[selectedMove];
        if (!m) return "";
        const family = view.moves.filter(n => familyKey(n) === familyKey(m));
        return `<div class="od-selection" data-od-selection><strong>${esc(moveText(m))}</strong>${m.payment ? `<p>Payment · ${esc(goodText(m.payment))}</p>` : ""}${family.length > 1 ? `<div class="od-row">${family.map(n => button(esc(goodText(n.payment)), `payment:${moveIndex(n)}`, `支付 ${fullGoods(n.payment)}`, false, `aria-pressed="${n === m}"`)).join("")}</div>` : ""}<div class="od-row">${button("Confirm", "confirm", moveExplanation(m), false, 'class="od-primary"')}${button("Cancel", "cancel", "取消尚未提交的选择。")}</div></div>`;
    }
    function transformed(key, turns = rotation, flip = flipped) {
        let cells = good(key).cells.map(([x, y]) => [flip ? -x : x, y]);
        for (let i = 0; i < turns; i++) cells = cells.map(([x, y]) => [-y, x]);
        const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
        return cells.map(([x, y]) => [x-minX, y-minY]);
    }
    function geometry() {
        const p = player(inspected), b = p.boards[boardIndex], data = view.catalog.boards[b.kind];
        const occupied = new Map();
        b.tiles.forEach((tile, i) => tile.cells.forEach(([x, y]) => occupied.set(`${x},${y}`, {good:tile.good, index:i, first:tile.cells[0][0] === x && tile.cells[0][1] === y})));
        return {p, b, data, occupied, layout:new Set(data.cells.map(c => c.join(","))), symbols:new Map(data.bonuses.map(v => [`${v.x},${v.y}`, v]))};
    }
    function preview(position = anchor) {
        if (!selectedGood || !position) return {cells:[], error:null};
        const {p, data, occupied, layout, symbols} = geometry();
        const d = good(selectedGood), color = d.color;
        const cells = transformed(selectedGood).map(([x, y]) => [x+position.x, y+position.y]);
        const ids = new Set(cells.map(c => c.join(",")));
        let error = null;
        if (inspected !== view.you || !view.can_place || !p.stock[selectedGood]) error = "Placement unavailable";
        const woodHouse = p.occupations.some(c => view.catalog.occupations[c.split(":")[0]].wood_house);
        const allowed = data.kind === "house" ? ["orange", "red", "green", "blue", "silver", ...(woodHouse ? ["wood"] : [])] : ["green", "blue", "silver", "ore"];
        if (!allowed.includes(color) || data.kind === "shed") error = "该货物不能放在这块板上";
        if (cells.some(c => !layout.has(c.join(",")))) error = "越出边缘或覆盖柱子";
        if (cells.some(c => occupied.has(c.join(",")))) error = "不能与已放货物重叠";
        const restricted = data.kind === "house" ? ["orange", "red"] : ["green"];
        if (restricted.includes(color) && cells.some(([x,y]) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(c => occupied.has(c.join(",")) && good(occupied.get(c.join(",")).good).color === color))) error = "这种颜色的不同板块不能共边";
        const covered = new Set([...occupied.keys(), ...symbols.keys(), ...ids]);
        data.tracks.forEach(track => track.steps.forEach(step => {
            if (ids.has(`${step.x},${step.y}`) && data.cells.some(([x,y]) => x >= step.origin[0] && x <= step.x && y >= step.y && y <= step.origin[1] && !covered.has(`${x},${y}`))) error = "先填满收入数字左下方区域";
        }));
        return {cells, error};
    }
    function paintGhost(position) {
        const check = preview(position), cells = new Set(check.cells.map(c => c.join(",")));
        root.querySelectorAll(".od-cell[data-od-cell]").forEach(el => {
            const active = cells.has(el.dataset.odCell);
            el.classList.toggle("od-ghost", active && !check.error);
            el.classList.toggle("od-invalid", active && !!check.error);
        });
    }
    function boardHtml() {
        const {p, b, data, occupied, layout, symbols} = geometry();
        const negative = new Set(data.negative.map(c => c.join(","))), income = new Map();
        data.tracks.forEach(track => track.steps.forEach(step => income.set(`${step.x},${step.y}`, step.value)));
        const cells = [];
        for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
            const key = `${x},${y}`, tile = occupied.get(key), symbol = symbols.get(key);
            if (!layout.has(key)) { cells.push('<div class="od-cell od-sea" aria-hidden="true"></div>'); continue; }
            let label = negative.has(key) ? "−1" : "", cls = negative.has(key) ? "od-negative" : "", style = "", description = negative.has(key) ? "未盖负分格(−1⭐)。" : "空白格，不扣分。";
            if (income.has(key)) { label = String(income.get(key)); cls = "od-income"; description = `收入数字 ${label}。${why("income")}`; }
            if (symbol) { label = Object.keys(symbol.goods).map(g => good(g).icon).join(""); cls = "od-bonus"; description = `${fullGoods(symbol.goods)}。${why("bonus")}`; }
            if (tile) {
                label = tile.first ? good(tile.good).icon : "";
                cls = "od-filled";
                const edge = (dx,dy) => occupied.get(`${x+dx},${y+dy}`)?.index === tile.index ? 0 : 1;
                style = `--od-tile:${colors[good(tile.good).color]};--od-t:${edge(0,-1)}px;--od-r:${edge(1,0)}px;--od-b:${edge(0,1)}px;--od-l:${edge(-1,0)}px`;
                description = `${goodName(tile.good)}，已放置，不能收回。`;
            }
            cells.push(button(esc(label), `cell:${x}:${y}`, description, !selectedGood || !view.can_place || inspected !== view.you,
                `class="od-cell ${cls}" data-od-cell="${key}" aria-label="${esc(`${x+1}, ${y+1} · ${description}`)}" style="${style}"`));
        }
        const controls = `<div class="od-board-tabs">${p.boards.map((other, i) => button(esc(view.catalog.boards[other.kind].name), `board:${i}`, "查看此板块。", false, `aria-pressed="${boardIndex === i}"`)).join("")}</div>`;
        const store = view.moves.filter(m => m.type === "store" && m.board === boardIndex);
        const materials = Object.entries(data.materials).map(([g,n]) => passive(`${good(g).icon} ${b.materials[g]}/${n}`, `${goodName(g)}储存格；每格未填扣 1 分。`)).join("");
        return `${controls}<div class="od-title"><h3>${esc(data.name)}</h3>${passive(`⭐ ${data.points || "家园"}`, data.kind === "home" ? "home" : "score")}</div>${data.cells.length ? `<div class="od-grid-wrap"><div class="od-grid" style="--od-cols:${data.width}" aria-label="${esc(data.name)}">${cells.join("")}</div></div>` : ""}${materials ? `<div class="od-row">${materials}</div>${optionList(store)}` : ""}<div class="od-legend">${passive("🟩 ↔ 🟩 ×", data.kind === "house" ? "house" : "home")}${passive("🪙 收入", "income")}${passive("🎁 包围奖励", "bonus")}</div>${placementHtml()}${inventoryHtml()}`;
    }
    function placementHtml() {
        if (!selectedGood) return "";
        const check = preview();
        return `<div class="od-placement"><strong>${good(selectedGood).icon} ${esc(good(selectedGood).name)} · ${anchor ? `${anchor.x+1}, ${anchor.y+1}` : "Select a square"}</strong><div class="od-row">${button("↻ Rotate", "rotate", "旋转所选货物 90 度。快捷键 R。")}${button("↔ Flip", "flip", "镜像所选货物。快捷键 F。")}${button("Cancel", "cancel", "placement")}</div>${check.error ? `<p class="od-invalid-text" role="status">${esc(check.error)}</p>` : ""}${button("Confirm placement", "place", "placement", !anchor || !!check.error, 'class="od-primary"')}</div>`;
    }
    function inventoryHtml() {
        const p = player(inspected);
        const stock = Object.entries(p.stock).filter(([, n]) => n > 0);
        return `<div class="od-title od-stock-head"><h3>货物库存</h3>${passive("🟧 → 🟥 → 🟩 → 🟦", "upgrade")}</div><div class="od-inventory">${stock.map(([g, n]) => {
            const d = good(g), description = `${goodName(g)}：${d.width}×${d.height}，${d.cells.length} 格。${why("placement")}`;
            return button(`${mini(g)}<span>${esc(d.name)}<br><small>${d.width}×${d.height}</small></span><b>${n}</b>`, `good:${g}`, description, inspected !== view.you || !view.can_place,
                `class="od-good ${g === selectedGood ? "od-selected" : ""}" style="--od-tile:${colors[d.color]}" aria-pressed="${g === selectedGood}"`);
        }).join("") || '<p class="od-muted">Empty supply</p>'}</div>`;
    }
    function harborHtml() {
        const p = player(inspected);
        return `<div class="od-title"><h3>港湾</h3>${passive("🛶 ≤3 · ⛵🚢 ≤4", "ships")}</div><div class="od-card-list">${p.ships.map((s,i) => `<div class="od-ship"><span>${passive(view.catalog.ships[s.kind].icon, "ships", "")}</span><div><strong>${esc(view.catalog.ships[s.kind].name)}</strong><p>${passive(`🔷 ${s.ore}/${view.catalog.ships[s.kind].capacity}`, "ships")} ${passive(`⭐ ${view.catalog.ships[s.kind].points}`, "score")}</p>${inspected === view.you ? view.moves.filter(m => m.type === "arm" && m.index === i).map(m => moveButton(m)).join("") : ""}</div></div>`).join("") || '<p class="od-muted">尚无船只</p>'}</div><div class="od-title od-stock-head"><h3>Purchase ships</h3></div>${inspected === view.you ? optionList(moves("buy_ship")) : ""}<div class="od-title od-stock-head"><h3>移民</h3>${passive(`🧳 ${p.emigrations.length} · −${p.emigrations.length*3} 格`, "migration")}</div><div class="od-row">${p.emigrations.map(k => passive(`${view.catalog.ships[k].icon} ⭐ ${k === "knarr" ? 18 : 21}`, "migration")).join("")}</div><div class="od-title od-stock-head"><h3>武器</h3></div><div class="od-row">${Object.entries(p.weapons).map(([k,n]) => passive(`${good(k).icon} ${n}`, `${goodName(k)}。${why("dice")}`)).join("")}</div>`;
    }
    function islandsHtml() {
        return `<div class="od-title"><h3>探索海域</h3>${passive("🧭 数字布局", "version")}</div><div class="od-card-list">${view.islands.map((island,i) => {
            const b = view.catalog.boards[island.kind], negative = new Set(b.negative.map(c => c.join(",")));
            const m = moves("explore").find(n => n.index === i);
            return `<div class="od-island"><strong>${esc(b.name)}</strong><div class="od-island-preview" style="--island-cols:${b.width}" aria-hidden="true">${b.cells.map(c => `<i class="${negative.has(c.join(",")) ? "od-island-penalty" : ""}"></i>`).join("")}</div><div class="od-row">${passive(`⭐ ${b.points} / −${b.negative.length}`, "score")}${passive(`🪙 ${island.silver}`, "尚未探索的岛在规定轮次获得 2 银币，探索者领取。翻面会清除积累银币。")}</div><small>${island.owner ? esc(name(island.owner)) : `🧑‍🌾 ${b.tier} · ${b.tier === 1 ? "🛶 / ⛵ / 🚢" : b.tier === 2 ? "⛵ / 🚢" : "🚢"}`}</small>${m ? moveButton(m) : ""}</div>`;
        }).join("")}</div><div class="od-mountains"><h3>山地</h3>${view.mountains.map(m => `<div class="od-mountain">${passive(`⛰️ ${m.id+1} →`, "mountain")}${m.items.map(g => passive(g === "silver2" ? "🪙 2" : good(g).icon, g === "silver2" ? "银币(🪙)两枚，按一项资源计算。" : goodName(g))).join("")}</div>`).join("")}</div>`;
    }
    function jobsHtml() {
        const p = player(inspected);
        const cards = (p.hand || []).map(c => [c, false]).concat(p.occupations.map(c => [c, true]));
        return `<div class="od-title"><h3>职业</h3>${passive(`📜 ${p.hand_count} 手牌 · ${p.occupations.length} 已打`, "occupation")}</div><div class="od-card-list">${cards.map(([c, played]) => {
            const d = view.catalog.occupations[c.split(":")[0]];
            const list = view.moves.filter(m => m.card === c);
            return `<div class="od-job" data-od-explain="${esc(d.text)}"><div class="od-job-head"><strong>📜 ${esc(d.name)}</strong><b>⭐ ${d.points}</b></div><p>${esc(d.text)}</p><small>${esc(d.number)} · ${played ? "In play" : "Private hand"}</small>${list.map(m => moveButton(m)).join("")}</div>`;
        }).join("") || '<p class="od-muted">手牌只对本人可见</p>'}</div>`;
    }
    function feastHtml() {
        if (view.phase !== "feast") return "";
        const p = own();
        if (!p) return "";
        const used = p.feast.reduce((n,t) => n+t.width,0), seats = [];
        p.feast.forEach(t => {
            seats.push(`<div class="od-seat od-served" style="grid-column:span ${t.width};--od-tile:${t.good === "gap" ? "#995f54" : colors[good(t.good).color]}" data-od-tip="${esc(t.good === "gap" ? "缺粮 −3 分(⭐)" : goodName(t.good))}">${t.good === "gap" ? "−3" : good(t.good).icon}</div>`);
        });
        for (let i = used; i < p.feast_length; i++) seats.push('<div class="od-seat">·</div>');
        const done = view.feast_done.includes(view.you);
        return `<div class="od-feast"><div class="od-title"><h3>🍽️ 宴会 · ${used}/${p.feast_length}</h3>${passive(`🧳 −${p.emigrations.length*3}`, "migration")}</div><div class="od-table" style="--seats:${Math.max(1,p.feast_length)}">${seats.join("")}</div>${done ? '<p class="od-muted">Waiting for other players…</p>' : `${optionList(moves("serve"))}<div class="od-controls">${view.moves.filter(m => ["auto_feast", "finish_feast", "serve_gap", "no_mead"].includes(m.type)).map(m => moveButton(m, null, m.type === "auto_feast" ? 'class="od-primary"' : "")).join("")}</div>`}</div>`;
    }
    function consoleHtml() {
        const mine = view.current_turn === view.you, p = own();
        const selected = selectionHtml();
        if (!p) return '<h3>Spectating</h3><p class="od-muted">可以查看公开棋盘、港湾与职业。</p>';
        if (view.phase === "round_end" || view.phase === "game_over") return `<h3>${view.phase === "game_over" ? "Game over" : "Round complete"}</h3><p class="od-muted">${view.phase === "game_over" ? "最终分数已在上方列出。" : "查看上方结算后确认继续。"}</p>`;
        if (["prepare", "final_placement"].includes(view.phase)) {
            const m = moves("ready")[0];
            return `<h3>${view.phase === "prepare" ? "Income preparation" : "Final placement"}</h3><p class="od-muted">${view.phase === "prepare" ? "完成货物拼板后准备发放收入。" : "完成最后拼板与房屋填充后计分。"}</p>${selected}<div class="od-controls">${m ? moveButton(m, null, 'class="od-primary"') : '<p class="od-muted">Waiting for other players…</p>'}</div>${optionList(moves("store"))}`;
        }
        if (view.phase === "feast") return `<h3>Feast planning</h3><p class="od-muted">选择上方食物供餐；或 Auto Feed 自动安排。</p>${selected}`;
        if (mine && pending()) {
            const e = pending();
            let dice = "";
            if (e.kind === "dice") {
                const high = ["raid", "pillage"].includes(e.mode);
                dice = `<div class="od-dice"><div class="od-die">${e.roll}</div><div><strong>🎲 d${e.sides} · roll ${e.rolls}</strong><p class="od-muted">${high ? "高点数" : "低点数"} · 船只修正 ${high ? "+" : "−"}${e.boost}</p></div></div>`;
            }
            return `<h3 class="od-turn-label">Your action</h3><div class="od-pending-title">${esc(e.kind === "dice" ? "狩猎与劫掠" : effectText(e))}</div>${dice}${selected}${optionList(view.moves.filter(m => !["skip", "fail", "reroll"].includes(m.type)))}<div class="od-controls">${view.moves.filter(m => ["skip", "fail", "reroll"].includes(m.type)).map(m => moveButton(m)).join("")}</div>`;
        }
        const active = mine && view.active;
        const cards = Object.entries(view.catalog.actions).filter(([,a]) => a.group === group).map(([key,a]) => {
            const m = moves("occupy").find(n => n.space === key), occupied = view.occupied[key];
            return button(`<div class="od-action-top"><strong>${esc(a.name)}</strong><span class="od-worker-cost">🧑‍🌾 ${a.workers}</span></div><small>${esc(a.effects.map(effectText).join(" · "))}</small>${occupied ? `<span class="od-occupied">${esc(name(occupied.player_id))}</span>` : ""}`, m ? `move:${moveIndex(m)}` : "none", actionExplanation(key), !m, 'class="od-action"');
        });
        return `<div class="od-title"><h3 class="od-turn-label">${mine ? active ? "Action complete" : "Your turn" : `${esc(name(view.current_turn))} · 行动中`}</h3>${passive(`🧑‍🌾 ${p.workers}`, "workers")}</div>${selected}<nav class="od-groups" aria-label="Action categories">${Object.entries(groups).map(([k,label]) => button(label, `group:${k}`, `查看${label}行动。`, false, `aria-pressed="${group === k}"`)).join("")}</nav><div class="od-action-list">${cards.join("")}</div>${optionList(moves("occupy").filter(m => m.copy))}<div class="od-controls">${button("Pass", "direct:pass", "pass", !moves("pass").length)}${button("End Turn", "direct:end_turn", "end_turn", !moves("end_turn").length, 'class="od-primary"')}</div>`;
    }
    function reviewHtml() {
        if (!["round_end", "final_placement", "game_over"].includes(view.phase)) return "";
        const labels = {ships:"船只", emigration:"移民", islands:"探索", houses:"房屋", animals:"家畜", occupations:"职业", silver:"银币", crown:"皇冠", uncovered:"未盖格", penalties:"宴会罚分", total:"总分"};
        const result = view.phase === "game_over";
        const m = moves("next_round")[0];
        const rows = result ? view.result.scores : view.review;
        return `<section class="od-review"><div class="od-title"><h3>${result ? "Game over" : `Round ${view.round} · 回顾`}</h3>${result ? passive(`🏆 ${esc(view.result.winners.map(name).join(" / "))}`, "并列最高分玩家共同获胜。") : passive(`${view.ready.length}/${view.players.length} ready`, "next")}</div><div class="od-review-cards">${rows.map(r => `<div class="od-review-player"><strong>${esc(name(r.player_id))}</strong>${result ? `<div class="od-score-lines">${Object.entries(labels).map(([k,label]) => `<span>${label}</span><b>${r[k]}</b>`).join("")}</div>` : `${passive(`🪙 +${r.income} · 缺粮 −${r.penalties*3}⭐`, "income")}<span>繁殖：${Object.entries(r.breeding).map(([g,k]) => `${good(g).icon} ${k === "birth" ? "+1" : "怀孕"}`).join(" · ") || "—"}</span><span>奖励：${esc(goodText(r.bonus))}</span>`}</div>`).join("")}</div>${m ? moveButton(m, null, 'class="od-primary"') : !result && view.phase === "round_end" ? '<span class="od-muted">Waiting for other players…</span>' : ""}</section>`;
    }
    function render() {
        if (!view) return;
        const p = player(inspected) || view.players[0];
        inspected = p.player_id;
        boardIndex = Math.min(boardIndex, p.boards.length-1);
        const scrolls = [...root.querySelectorAll(".od-inventory,.od-action-list,.od-options,.od-card-list,.od-log")].map(el => [el.className, el.scrollTop]);
        const focused = root.contains(document.activeElement) ? document.activeElement.dataset.odAction : null;
        const turn = view.current_turn === view.you && view.pending.length > 0;
        root.classList.toggle("od-pending", turn);
        const resources = ["silver", "wood", "stone", "ore"].map(g => passive(`${good(g).icon} ${p.stock[g] || 0}`, goodName(g))).join("");
        const harvest = view.catalog.harvest[view.round-1];
        root.innerHTML = `<header class="od-hero"><div><div class="od-wordmark">ODIN</div><div class="od-subtitle">奥丁的盛宴 · A FEAST FOR ODIN</div></div><div class="od-season"><strong>Round ${view.round} / ${view.rounds}</strong><span>${phases[view.phase]}</span>${passive(harvest ? `🌾 收获 ${harvest}` : "🌾 无收获", "本轮开始时自动获得对应等级的橙色农产品。")}</div></header>
            <div class="od-players ${view.players.length === 1 ? "od-single" : ""}" style="--od-players:${view.players.length}">${view.players.map((other,i) => button(`<span class="od-player-name">${other.player_id === view.first_player ? "🫎 " : ""}${esc(other.name)}${other.is_bot ? " · AI" : ""}</span><span class="od-score">${other.projected.total}⭐</span><small>🧑‍🌾 ${other.workers} · 🪙 ${other.stock.silver || 0} · 收入 ${other.income}</small>`, `player:${i}`, "score", false, `class="od-player ${other.player_id === view.current_turn ? "od-turn" : ""}" style="--od-player:${playerColors[i]}" aria-pressed="${inspected === other.player_id}"`)).join("")}</div>
            <div class="od-resources">${resources}${passive(`🪙 收入 ${p.income}`, "income")}${passive(`🍽️ ${p.feast_length} 格`, "feast")}${passive(`🐑 ${p.stock.sheep || 0}+${p.stock.pregnant_sheep || 0}`, "绵羊(🐑)：普通数量 + 怀孕数量。两只普通羊隔轮繁殖；怀孕羊下次产一只羊。")}${passive(`🐄 ${p.stock.cattle || 0}+${p.stock.pregnant_cattle || 0}`, "牛(🐄)：普通数量 + 怀孕数量。繁殖规则同羊；普通牛 3 分，怀孕牛 4 分。")}</div>
            ${feastHtml()}${reviewHtml()}<div class="od-layout"><section class="od-panel"><nav class="od-tabs" aria-label="Player board">${[["home","🏡 拼板"],["harbor","⛵ 港湾"],["islands","🧭 探索"],["jobs","📜 职业"]].map(([k,label]) => button(label, `tab:${k}`, `查看${label}。`, false, `aria-pressed="${tab === k}"`)).join("")}</nav><div class="od-board-body">${({home:boardHtml, harbor:harborHtml, islands:islandsHtml, jobs:jobsHtml})[tab]()}</div></section><aside class="od-console" aria-label="Actions">${consoleHtml()}</aside></div>
            <footer class="od-footer"><details><summary>Game Log</summary><div class="od-log">${view.log.slice().reverse().map(e => `<p>R${e.round} ${esc(e.player_id ? name(e.player_id)+" · " : "")}${esc(e.text)}</p>`).join("")}</div></details>${passive("数字适配 · 精选职业", "version")}</footer>`;
        root.classList.toggle("od-explaining", explaining);
        scrolls.forEach(([cls, top]) => { const el = root.getElementsByClassName(cls)[0]; if (el) el.scrollTop = top; });
        if (focused) [...root.querySelectorAll("[data-od-action]")].find(el => el.dataset.odAction === focused)?.focus({preventScroll:true});
        if (tab === "home" && anchor) paintGhost(anchor);
    }
    function cancelSelection() { selectedMove = null; selectedGood = null; anchor = null; }
    function send(move) {
        if (!move || pendingSend || !view || typeof socket === "undefined") return;
        pendingSend = true;
        selectedMove = null; anchor = null; hideTip(); render();
        socket.emit("game:action", {action:move});
        clearTimeout(sendTimer);
        sendTimer = setTimeout(() => { pendingSend = false; render(); }, 5000);
    }
    const directTypes = new Set(["pass","end_turn","ready","next_round","skip","reroll","auto_feast","finish_feast","no_mead"]);
    root.addEventListener("click", event => {
        const control = event.target.closest("[data-od-action]");
        if (!control) {
            const target = event.target.closest("[data-od-tip]");
            if (target) showTip(target); else { cancelSelection(); render(); }
            return;
        }
        if (control.disabled) return;
        const [type, value, extra] = control.dataset.odAction.split(":");
        if (type === "tab") { tab = value; cancelSelection(); }
        else if (type === "player") { inspected = view.players[Number(value)].player_id; boardIndex = 0; cancelSelection(); }
        else if (type === "board") { boardIndex = Number(value); anchor = null; }
        else if (type === "group") { group = value; selectedMove = null; }
        else if (type === "good") { selectedGood = selectedGood === value ? null : value; anchor = null; rotation = 0; flipped = false; selectedMove = null; }
        else if (type === "cell") { anchor = {x:Number(value), y:Number(extra)}; }
        else if (type === "rotate") { rotation = (rotation+1)%4; }
        else if (type === "flip") { flipped = !flipped; }
        else if (type === "cancel") { cancelSelection(); }
        else if (type === "place") {
            if (anchor && !preview().error) send({type:"place", revision:view.revision, board:boardIndex, good:selectedGood, x:anchor.x, y:anchor.y, rotation, flip:flipped});
            return;
        } else if (type === "payment") { selectedMove = Number(value); }
        else if (type === "confirm") { send(view.moves[selectedMove]); return; }
        else if (type === "direct") { send(moves(value)[0]); return; }
        else if (type === "move") {
            const m = view.moves[Number(value)];
            if (!m) return;
            if (directTypes.has(m.type)) { send(m); return; }
            selectedMove = Number(value);
            render();
            root.querySelector("[data-od-selection]")?.scrollIntoView({block:"nearest", behavior:"smooth"});
            return;
        }
        render();
    });
    root.addEventListener("pointerover", event => {
        if (explaining) return;
        const target = event.target.closest("[data-od-tip]");
        if (target && event.pointerType !== "touch") showTip(target);
        const cell = event.target.closest("[data-od-cell]");
        if (cell && selectedGood && !anchor && event.pointerType !== "touch") {
            const [x,y] = cell.dataset.odCell.split(",").map(Number);
            paintGhost({x,y});
        }
    });
    root.addEventListener("pointerout", event => {
        if (event.pointerType === "touch") return;
        if (!event.target.closest("[data-od-tip]")?.contains(event.relatedTarget)) hideTip();
        if (selectedGood && !anchor && !event.relatedTarget?.closest?.(".od-grid")) paintGhost(null);
    });
    function hideTip() { tip.hidden = true; clearTimeout(tipTimer); }
    function showTip(target) {
        clearTimeout(tipTimer);
        tip.textContent = target.dataset.odTip;
        tip.hidden = false;
        const rect = target.getBoundingClientRect();
        tip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth-tip.offsetWidth-12))}px`;
        tip.style.top = `${Math.max(12, Math.min(rect.bottom+8, innerHeight-tip.offsetHeight-12))}px`;
        tipTimer = setTimeout(hideTip, 3000);
    }
    function setExplain(value) {
        explaining = value;
        root.classList.toggle("od-explaining", value);
        explain.setAttribute("aria-pressed", String(value));
        hideTip();
    }
    function openDialog(title, content, html = false) {
        restoreFocus = document.activeElement;
        document.getElementById("odinDialogTitle").textContent = title;
        const body = document.getElementById("odinDialogBody");
        if (html) body.innerHTML = content; else body.textContent = content;
        if (!dialog.open) dialog.showModal();
    }
    help.addEventListener("click", () => {
        setExplain(false);
        const sections = [
            ["版本范围", why("version")],
            ["目标与流程", "经营维京家园，获得货物来填盖负分格并提高收入。标准局 7 轮，短局 6 轮。每轮新增工人、收获、探索板翻面、抽武器；轮流行动，最后放工人的玩家下轮先手。全员 Ready 后发收入并繁殖，再供餐、发奖励、回顾。所有人 Next Round 才继续。"],
            ["工人行动", why("workers")+" 可以主动 Pass。四人有两个随机列的模仿格，只能复制别人已占的行动。单人时上轮行动保持占用，再下一轮释放。"],
            ["家园与货物", why("home")+" "+why("placement")+" "+why("income")+" "+why("bonus")],
            ["房屋", why("house")+" 棚屋 8 分、石屋 10 分、长屋 17 分。建筑供应分别 3/3/5 座。"],
            ["生产与贸易", why("upgrade")+" "+why("mountain")+" 橙色依次为豌豆(🫛)、亚麻(🌿)、蚕豆(🫘)、谷物(🌾)、卷心菜(🥬)、水果(🍎)。"],
            ["冒险与武器", why("dice")+" 狩猎使用弓箭(🏹)，陷阱使用陷阱(🪤)，捕鲸使用长矛(🔱)。捕鲸艇每艘预印 1 矿，劫掠只用装矿最多的长船。突袭不加装矿。失败狩猎/突袭不退工人，陷阱/劫掠退 1，捕鲸退 2。"],
            ["船只、探索与移民", why("ships")+" 近海探索需任意船，二级探索需大船，美洲探索需长船；船只保留。未领岛在指定轮次翻面或累积银币。"+why("migration")],
            ["家畜与宴会", "羊(🐑)普通/怀孕值 2/3 分；牛(🐄)值 3/4 分。已有怀孕母畜时翻回普通并生一只；否则至少两只普通畜时令一只怀孕。"+why("feast")+" No Mead 职业承诺后不能再供应蜂蜜酒；若要把这枚银币用于宴会，应先点击该选项。"],
            ["职业", why("occupation")+" 手牌可在职业标签查看；牌上直接展示效果。前后打职业、支付方式、升级目标、山地数量等均用按钮选择。"],
            ["结算", why("score")+" 最后一轮不发包围奖励，宴会后保留最终摆放；末轮已发收入包含在剩余银币中，不能再重复计分。"],
            ["界面操作", "无交互图标可悬停或点击显示提示，3 秒消失。Explain 后点目标查看说明，禁用按钮也支持；其他操作被暂时拦截。Esc 退出解释、弹窗或选择。Help/Explain 不会提交游戏操作。"],
        ];
        openDialog("Help · 奥丁的盛宴", sections.map(([title,text]) => `<h3>${esc(title)}</h3><p>${esc(text)}</p>`).join("")+ '<p><a href="https://www.feuerland-spiele.de/spiele/ein-fest-fuer-odin/" target="_blank" rel="noopener noreferrer">Publisher rules & appendix</a></p>', true);
    });
    explain.addEventListener("click", () => setExplain(!explaining));
    document.getElementById("odinClose").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { hideTip(); suppressedUntil = 0; if (restoreFocus?.isConnected) restoreFocus.focus({preventScroll:true}); });
    dialog.addEventListener("click", event => {
        const r = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
    });
    const activePanel = () => view && !panel.classList.contains("hidden");
    const exempt = target => help.contains(target) || explain.contains(target) || dialog.contains(target);
    function showExplanation(target) {
        if (!target?.dataset.odExplain) return;
        setExplain(false);
        openDialog("Explain", target.dataset.odExplain);
    }
    document.addEventListener("pointerdown", event => {
        if (!explaining || !activePanel() || exempt(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation(); suppressedUntil = Date.now()+650;
        const target = document.elementsFromPoint(event.clientX,event.clientY).map(el => el.closest("[data-od-explain]")).find(el => el && root.contains(el));
        showExplanation(target);
    }, true);
    document.addEventListener("click", event => {
        if (!activePanel() || exempt(event.target)) return;
        if (Date.now() < suppressedUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (explaining) { event.preventDefault(); event.stopImmediatePropagation(); showExplanation(event.target.closest("[data-od-explain]")); }
    }, true);
    document.addEventListener("keydown", event => {
        if (!activePanel()) return;
        if (event.key === "Escape") { setExplain(false); hideTip(); if (!dialog.open) { cancelSelection(); render(); } return; }
        if (explaining && !exempt(event.target) && ["Enter"," ","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (["Enter"," "].includes(event.key)) showExplanation(event.target.closest("[data-od-explain]"));
            return;
        }
        if (selectedGood && !dialog.open && !event.target.matches("input,select,textarea")) {
            if (event.key.toLowerCase() === "r") { rotation = (rotation+1)%4; render(); }
            if (event.key.toLowerCase() === "f") { flipped = !flipped; render(); }
        }
    }, true);
    function clearState() {
        view = null; room = null; inspected = null; tab = "home"; boardIndex = 0;
        cancelSelection(); pendingSend = false; clearTimeout(sendTimer); setExplain(false); root.innerHTML = "";
        if (dialog.open) dialog.close();
    }
    window.renderOdinGameState = data => {
        const next = data?.view;
        if (next?.game_id !== "a_feast_for_odin") return;
        if (room !== data.room_id) { cancelSelection(); inspected = null; boardIndex = 0; }
        if (room !== data.room_id || view?.revision !== next.revision) {
            selectedMove = null; anchor = null; pendingSend = false; clearTimeout(sendTimer);
        }
        room = data.room_id; view = next;
        if (!player(inspected)) inspected = own()?.player_id || next.players[0].player_id;
        if (selectedGood && (!own()?.stock[selectedGood] || !view.can_place)) selectedGood = null;
        render();
    };
    window.showOdinHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clearState();
        if (typeof syncRoomControlsExplainButton === "function") syncRoomControlsExplainButton();
    };
    window.clearOdinState = clearState;
    window.getOdinConfig = () => ({rounds:view?.rounds || Number(document.getElementById("odinRounds").value)});
    let configRoom = null;
    function syncConfig(state) {
        const box = document.getElementById("odinConfigBox"), select = document.getElementById("odinRounds");
        const visible = state?.game_type === "a_feast_for_odin" && state.status === "lobby";
        box.classList.toggle("hidden", !visible);
        box.setAttribute("aria-hidden", String(!visible));
        select.disabled = !visible;
        if (visible && configRoom !== state.room_id) select.value = String(state.game_config?.rounds || 7);
        configRoom = visible ? state.room_id : null;
    }
    function connect() {
        if (typeof socket !== "undefined") {
            socket.on("system:error", () => { if (pendingSend) { pendingSend = false; clearTimeout(sendTimer); render(); } });
            socket.on("room:state", state => {
                syncConfig(state);
                if (state.game_type !== "a_feast_for_odin" || state.status === "lobby") clearState();
            });
        }
        if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
        if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "a_feast_for_odin" && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "a_feast_for_odin") window.renderOdinGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connect, {once:true}); else connect();
})();
