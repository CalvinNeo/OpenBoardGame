(() => {
    "use strict";

    const byId = suffix => document.getElementById(`manila${suffix}`);
    const panel = byId("Panel");
    const header = byId("HeaderActions");
    const tooltip = byId("Tooltip");
    const helpDialog = byId("HelpModal");
    const explainDialog = byId("ExplainModal");
    const cargoOrder = ["nutmeg", "silk", "ginseng", "jade"];
    const cargoData = {
        nutmeg: {name: "肉豆蔻", english: "Nutmeg", icon: "🟫", value: 24, costs: [2, 3, 4]},
        silk: {name: "丝绸", english: "Silk", icon: "🟨", value: 18, costs: [1, 2, 3]},
        ginseng: {name: "人参", english: "Ginseng", icon: "🟩", value: 36, costs: [3, 4, 5, 5]},
        jade: {name: "翡翠", english: "Jade", icon: "🟦", value: 30, costs: [3, 4, 5]},
    };
    const phaseNames = {
        auction: "竞选港务长", harbormaster_pay: "支付竞拍款", harbormaster_buy: "购买股票",
        harbormaster_cargo: "选择货物", harbormaster_position: "安排起点", placement: "派遣工人",
        pilot: "领航调整", pirate: "海盗行动", round_end: "航次结算", game_over: "最终结算",
    };
    const explanations = {
        market: ["货物与股价", "四种货物各有股票。只有港务长可以每航次购买一张，价格至少为 💰5。成功入港的货物股价上升一档；持有数只向自己显示。"],
        cargo: ["选择三种货物", "从肉豆蔻（🟫）、丝绸（🟨）、人参（🟩）、翡翠（🟦）中选三种出航。再次点击可取消，点击空白处取消当前选择。选择顺序对应三艘船。"],
        voyage: ["航道与入港", "⛵ 从 0–13 格航道出发，每次派遣结束后各掷一个 🎲。驶过 13 格入港；正好在 13 格的船可能遇上海盗。绿色入港标记和 🛠️ 修船结果以结算状态为准。"],
        ship: ["⛵ 船上工人", "支付该座位的入场费，派遣一名工人。船成功入港且未被劫掠时，船上全部工人平分货物总收益，多名自己的工人可以获得多份分红。"],
        port: ["⚓ 码头", "A / B / C 分别在至少 1 / 2 / 3 艘船入港时支付收益。入场费依次为 💰4 / 3 / 2，收益为 💰6 / 8 / 15。"],
        shipyard: ["🛠️ 修船厂", "A / B / C 分别在至少 1 / 2 / 3 艘船失败时支付收益。入场费依次为 💰4 / 3 / 2，收益为 💰6 / 8 / 15。"],
        pirate: ["🏴‍☠️ 海盗", "每个位置入场费 💰5，先当船长，再当船员。第 2 次移动后可登上停在 13 格且有空位的船；第 3 次移动后由船长劫掠目标，海盗平分货物价值，船长决定船去码头或修船厂。"],
        pilot: ["🧭 领航员", "大领航员入场费 💰5，小领航员 💰2。最后一次掷骰前，大领航员先行动，可移动一船最多两格，或两船各一格；小领航员随后移动一船最多一格。先用 + / − 预览，再 Confirm。"],
        insurance: ["🛡️ 保险", "派一名工人，入场费 💰0，立即获得 💰10。结算时每艘失败的船需赔付 💰10，现金不足可能强制抵押股票。"],
        pledge: ["🏦 抵押股票", "抵押一张自己持有的股票获得现金。默认贷款 💰12、终局扣除 💰15，以房间设置为准。已抵押的股票不再按股价计分，也不能赎回。"],
        bid: ["竞选港务长", "出价必须是高于当前最高价的整数。竞得后支付出价，可先抵押股票补款。Pass 后本次拍卖不能重新参与。港务长可以买股、选择货物和安排起点。"],
        position: ["安排起点", "三艘船的起点各在 0–13 格，合计必须为 9。用船旁 + / − 调整，航道实时预览，Confirm 后才发送。"],
        pass: ["Pass", "放弃这一次派遣机会，不花钱、不消耗工人。本次派遣轮仍会继续，已派遣的工人保留在原位。"],
        next: ["Next Round", "确认已看完结算。所有玩家准备后才开始下一航次；准备状态会实时显示。点击只发送一次，不再弹出确认。"],
        cash: ["现金（💰）", "可用于竞拍、买股和派遣工人的现金。收益与费用分开显示；抵押股票可以补充现金。"],
        workers: ["工人（👤）", "显示本航次剩余 / 总工人数。每次派遣使用一名工人，下一航次全部收回。"],
        result: ["航次账本", "绿色 + 是本航次收入，红色 − 是支出，净额是两者之差，不是最终得分。终局胜者由服务器按现金、股票市值和抵押债务计算。"],
        confirm: ["Confirm / Cancel", "Confirm 提交当前预览，Cancel 或点击周围空白取消。确认前不会发送行动；等待服务器响应时不能重复提交。"],
    };
    const help = `
        <h3>目标 · 成为最富有的商人</h3>
        <p>在马尼拉投资货船（⛵）、股票和港湾职位。任一股价达到 💰30 时游戏结束；现金 + 未抵押股票市值 − 抵押债务最高者获胜，可以并列。</p>
        <h3>货物与资源</h3>
        <p>肉豆蔻 Nutmeg（🟫）：总收益 💰24，3 个座位；丝绸 Silk（🟨）：💰18，3 个座位；人参 Ginseng（🟩）：💰36，4 个座位；翡翠 Jade（🟦）：💰30，3 个座位。颜色与文字同时标识货物。</p>
        <p>现金（💰）、工人（👤）、股票（📜）、抵押债务（🏦）、骰子（🎲）、隐藏持仓（🔒）。P1–P5 对应座次，YOU 是自己，Winner（🏆）是胜者。收益 + 与入场费分开显示。股票种类对其他玩家保密。</p>
        <h3>每一航次</h3>
        <ol><li><strong>拍卖：</strong>轮流提高出价或 Pass。竞得者支付费用成为港务长，现金不足时先抵押股票。</li>
        <li><strong>备航：</strong>港务长可买一张股票（价格至少 💰5），再选三种货物；三船起点合计 9，每船 0–13 格。</li>
        <li><strong>出航：</strong>共三次派遣。每位玩家依次放一名工人或 Pass，每次派遣结束后各船掷 🎲1–6 前进。三人游戏每人 4 名工人，四至五人每人 3 名。</li>
        <li><strong>结算：</strong>各职位支付收益，成功货物股价按 0 → 5 → 10 → 20 → 30 上升。账本保留，所有玩家点击 Next Round 后才继续。</li></ol>
        <h3>船、码头和修船厂</h3>
        <p>⛵ 船驶过 13 格入港；正好停在 13 格可能受到海盗影响。成功且未被劫掠的船，其货物收益由船上全部工人平分，每位玩家所得向上取整。</p>
        <p>⚓ 码头 A / B / C 押注至少 1 / 2 / 3 船成功；🛠️ 修船厂 A / B / C 押注至少 1 / 2 / 3 船失败。各组入场费为 💰4 / 3 / 2，收益为 💰6 / 8 / 15。</p>
        <h3>特殊职位</h3>
        <p>🏴‍☠️ 海盗：入场费 💰5，先船长后船员。第二次移动可登上停在 13 格、有空位的船，也可以 Skip。第三次移动由船长劫掠目标，海盗平分价值；船上工人无收益，船长选择该船算码头或修船厂。第三次不能 Skip。</p>
        <p>🧭 领航员：最后一次掷骰前，大领航员（入场费 💰5）先移动一船最多两格，或两船各一格；小领航员（💰2）随后移动一船最多一格。可以不移动。经领航到达 13 格的船受海盗保护，超过 13 格立即入港。</p>
        <p>🛡️ 保险：入场费 💰0，立即领 💰10，每艘失败船赔 💰10。🏦 抵押：默认每股借 💰12、终局扣 💰15，房间可配置；不再计入持股，不能赎回。</p>
        <h3>操作与查看</h3>
        <p>点选座位或职位，在原处 Confirm；Cancel 或点空白处撤销。货物再次点击可以取消，三个起点和领航移动均可预览。规则不挡住棋盘；Help 查看规则，Explain 再点目标查看解释，灰色按钮也可解释。Esc 退出解释或关闭对话框。静态图标可悬停查看，手机轻点后的提示 3 秒消失，滑动不会选择。</p>
        <p>轮到你时收起的 Room Controls 显示红色边框。Players 可展开查看公开现金、工人和持股总数；航次结算突出 YOU，Details 可查看收支。终局保留棋盘与胜者，重新开局使用 Room Controls。</p>`;

    let view = null;
    let roomKey = null;
    let stateSignature = "";
    let contextKey = "";
    let selection = null;
    let selectedCargo = [];
    let positions = {};
    let pilotMoves = {};
    let bidAmount = null;
    let pending = false;
    let explaining = false;
    let tipTimer = null;
    let tipTarget = null;
    let pointer = null;
    let suppressClickUntil = 0;
    let focusBeforeDialog = null;
    let lastActivity = "";

    const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
    const own = () => view?.players?.find(player => player.player_id === view.you);
    const playerName = playerId => view?.players?.find(player => player.player_id === playerId)?.name || playerId || "—";
    const playerToken = playerId => playerId === view?.you ? "YOU" : `P${Math.max(0, view?.players?.findIndex(player => player.player_id === playerId)) + 1}`;
    const connected = () => typeof socket !== "undefined" && socket.connected && (typeof roomSessionReady === "undefined" || roomSessionReady);
    const can = type => !!view && !pending && connected() && !!own() && view.legal_actions?.includes(type);
    const hasAction = type => !!view?.legal_actions?.includes(type);
    const activePilot = () => view?.phase === "pilot" ? view.pending_pilots?.[0] : null;
    const canPilot = () => can("pilot_move") && view.current_player === view.you && view.board?.pilots?.[activePilot()] === view.you;
    const canPlace = cost => can("place_worker") && view.current_player === view.you && own().workers_available > 0 && own().cash >= cost;
    const cargoLabel = cargo => `${cargoData[cargo].icon} ${cargoData[cargo].name}`;
    const total = values => Object.values(values || {}).reduce((sum, amount) => sum + amount, 0);
    const tip = (message, key = "") => `data-manila-tip="${escape(message)}" tabindex="0"${key ? ` data-manila-explain="${key}"` : ""}`;
    const explanation = (key, detail = "") => `data-manila-explain="${key}"${detail ? ` data-manila-detail="${escape(detail)}"` : ""}`;
    const button = (label, operation, {disabled = false, key = "confirm", detail = "", extra = "", className = ""} = {}) => `<button type="button" class="${className}" data-manila-op="${operation}" ${explanation(key, detail)} ${extra}${disabled ? " disabled" : ""}>${label}</button>`;
    const visible = (node, show) => node.classList.toggle("hidden", !show);

    function isOurTurn() {
        if (!view || !own() || view.game_over) return false;
        if (view.phase === "round_end") return hasAction("next_round");
        if (view.phase === "pilot") return view.current_player === view.you && view.board?.pilots?.[activePilot()] === view.you;
        return view.current_player === view.you && view.legal_actions?.length > 0;
    }

    function loanConfig(key, fallback) {
        const config = typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "manila" ? currentRoomState.game_config : null;
        return Number.isFinite(config?.[key]) ? config[key] : fallback;
    }

    function setError(message = "") {
        byId("Error").textContent = message;
        visible(byId("Error"), !!message);
    }

    function dispatch(action) {
        if (explaining || !can(action.type)) return;
        if (action.type.startsWith("pilot_") && !canPilot()) return;
        pending = true;
        selection = null;
        hideTip();
        setError();
        render();
        sendAction(action);
    }

    function hideTip() {
        clearTimeout(tipTimer);
        tipTimer = null;
        tipTarget?.removeAttribute("aria-describedby");
        tipTarget = null;
        visible(tooltip, false);
    }

    function showTip(target, autoHide = false) {
        if (!target || explaining || helpDialog.open || explainDialog.open || target.closest("button, input, select, summary, a")) return;
        hideTip();
        tipTarget = target;
        target.setAttribute("aria-describedby", tooltip.id);
        tooltip.textContent = target.dataset.manilaTip;
        visible(tooltip, true);
        const anchor = target.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - box.width - 12))}px`;
        tooltip.style.top = `${anchor.bottom + box.height + 12 < innerHeight ? anchor.bottom + 6 : Math.max(12, anchor.top - box.height - 6)}px`;
        if (autoHide) tipTimer = setTimeout(hideTip, 3000);
    }

    function setExplain(value) {
        explaining = value;
        document.body.classList.toggle("manila-explaining", value);
        byId("ExplainBtn").setAttribute("aria-pressed", String(value));
        byId("ExplainBtn").title = value ? "Choose an item · Esc to exit" : "Explain";
        hideTip();
    }

    function openDialog(dialog) {
        hideTip();
        focusBeforeDialog = document.activeElement;
        if (!dialog.open) dialog.showModal();
        dialog.querySelector("button").focus({preventScroll: true});
    }

    function showExplanation(target) {
        const entry = explanations[target?.dataset.manilaExplain];
        if (!entry) return;
        setExplain(false);
        byId("ExplainTitle").textContent = entry[0];
        byId("ExplainBody").innerHTML = `<p>${escape(entry[1])}</p>${target.dataset.manilaDetail ? `<p>${escape(target.dataset.manilaDetail)}</p>` : ""}`;
        openDialog(explainDialog);
    }
    function confirmation(host) {
        if (!selection || selection.host !== host) return "";
        const options = selection.kind === "plunder" ? `<div class="manila-confirm-options" role="group" aria-label="Plunder destination">
            ${["port", "shipyard"].map(result => button(result === "port" ? "⚓ 码头" : "🛠️ 修船厂", "destination", {
                key: "pirate", extra: `data-result="${result}" aria-pressed="${selection.action.result === result}"`,
            })).join("")}</div>` : "";
        return `<div class="manila-confirm" data-manila-selection="${escape(selection.key)}">
            <div class="manila-confirm-title">${escape(selection.title)}</div>
            <p class="manila-confirm-note">${escape(selection.note)}</p>${options}
            <div class="manila-confirm-options">
                ${button("Confirm", "confirm", {className: "manila-primary", disabled: pending})}
                ${button("Cancel", "cancel")}
            </div>
        </div>`;
    }

    function renderMarket() {
        const choosing = view.phase === "harbormaster_cargo" && view.harbormaster === view.you;
        const buying = view.phase === "harbormaster_buy" && view.harbormaster === view.you;
        byId("Market").innerHTML = cargoOrder.map(cargo => {
            const meta = cargoData[cargo];
            const price = view.price_track?.[cargo] || 0;
            const buyPrice = Math.max(5, price);
            const selected = selectedCargo.includes(cargo) || selection?.key === `buy-${cargo}`;
            const sailing = view.cargo_slots?.includes(cargo);
            const holdings = own() ? `持有 ${own().stocks?.[cargo] || 0}` : "🔒 持仓";
            const contents = `<span class="manila-market-name"><span>${meta.icon}</span><span>${meta.name}</span></span>
                <span class="manila-market-numbers"><span class="manila-market-price">💰 ${price}</span><span class="manila-market-holding">${holdings}</span></span>
                ${buying ? `<span class="manila-small">买入 💰${buyPrice}</span>` : ""}`;
            const className = `manila-market-card manila-cargo-${cargo}${selected ? " is-selected" : ""}${sailing ? " is-sailing" : ""}`;
            if (choosing || buying) return button(contents, choosing ? "cargo" : "buy", {
                key: choosing ? "cargo" : "market", className,
                disabled: choosing ? !can("select_cargo") || (!selected && selectedCargo.length === 3) : !can("buy_stock") || own().cash < buyPrice,
                extra: `data-cargo="${cargo}" aria-pressed="${selected}" data-manila-focus="market-${cargo}"`,
                detail: `${cargoLabel(cargo)} · 股价 💰${price} · ${holdings} · 货物总收益 💰${meta.value}`,
            });
            return `<div class="${className}" ${tip(`${meta.name} ${meta.english}（${meta.icon}）· 股价 💰${price} · ${holdings} · 货物收益 💰${meta.value}${sailing ? " · 本航次出航" : ""}`, "market")}>${contents}</div>`;
        }).join("") + confirmation("market");
    }

    function shipStatus(boat, preview) {
        if (preview) return view.harbormaster === view.you ? "备航预览" : "等待港务长确认起点";
        if (boat.plundered) return `🏴‍☠️ 已劫掠 → ${boat.plunder_result === "port" ? "⚓ 码头" : "🛠️ 修船厂"}`;
        if (boat.arrived) return `⚓ 已入港${boat.arrived_slot ? ` · ${boat.arrived_slot}` : ""}`;
        if (view.phase === "round_end" || view.game_over) return "🛠️ 未入港";
        if (boat.position === 13) return boat.safe_from_pirates ? "13 格 · 海盗保护" : "13 格 · 海盗水域";
        return `第 ${boat.position} 格 · 距港口 ${13 - boat.position}`;
    }

    function pilotAllowed(cargo, next) {
        if (!canPilot() || view.boats?.[cargo]?.arrived) return false;
        const draft = {...pilotMoves, [cargo]: next};
        const used = Object.values(draft).reduce((sum, delta) => sum + Math.abs(delta), 0);
        if (used > (activePilot() === "big" ? 2 : 1)) return false;
        return (view.boats[cargo].position + next >= 0) || Math.abs(next) < Math.abs(pilotMoves[cargo] || 0);
    }

    function renderBoats() {
        let cargos = (view.cargo_slots || []).filter(cargo => cargoData[cargo]);
        if (view.phase === "harbormaster_cargo" && view.harbormaster === view.you) cargos = selectedCargo;
        if (!cargos.length) {
            byId("Boats").innerHTML = `<div class="manila-empty"><div class="manila-harbor-art" aria-hidden="true">⛵ &nbsp; ⛵ &nbsp; ⛵</div><strong>风起之前，先选航线</strong><p>港务长选定三种货物后启航</p></div>`;
            return;
        }
        const settingPositions = view.phase === "harbormaster_position" && view.harbormaster === view.you;
        byId("Boats").innerHTML = cargos.map(cargo => {
            const meta = cargoData[cargo];
            const liveBoat = view.boats?.[cargo];
            const preview = !liveBoat;
            const boat = liveBoat || {position: positions[cargo] ?? 3, seats: [], total_value: meta.value, seat_costs: meta.costs};
            const delta = pilotMoves[cargo] || 0;
            const knownPosition = !!liveBoat || settingPositions;
            const position = Math.max(0, Math.min(13, (settingPositions ? positions[cargo] : boat.position) + delta));
            const status = shipStatus(boat, preview);
            const vessel = '<svg class="manila-vessel" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M10 1v9H2L10 1Zm2 3 3 6h-3V4ZM1 12h14l-3 3H4l-3-3Z"/></svg>';
            const track = Array.from({length: 14}, (_, index) => `<span aria-hidden="true" class="manila-track-cell${knownPosition && index < position ? " is-passed" : ""}${knownPosition && index === position ? " is-boat" : ""}${index === 13 ? " is-port" : ""}${[0, 3, 6, 9, 13].includes(index) ? " is-landmark" : ""}${delta && index === position ? " is-draft" : ""}">${knownPosition && index === position ? vessel : index}</span>`).join("");
            const seats = preview ? "" : `<div class="manila-seats" style="--seats:${boat.seats.length}">${boat.seats.map((occupant, seat) => {
                const cost = boat.seat_costs[seat];
                if (occupant) return `<div class="manila-occupant${occupant === view.you ? " is-you" : ""}" ${tip(`👤 ${playerName(occupant)} · ${meta.name}第 ${seat + 1} 个座位`, "ship")}><span>👤 ${playerToken(occupant)}</span><span>座位 ${seat + 1}</span></div>`;
                return button(`<span class="manila-seat-cost">💰 ${cost}</span><span>座位 ${seat + 1}</span>`, "seat", {
                    key: "ship", disabled: !canPlace(cost) || boat.plundered,
                    className: `manila-seat${selection?.key === `seat-${cargo}-${seat}` ? " manila-selected" : ""}`,
                    extra: `data-cargo="${cargo}" data-seat="${seat}" data-manila-focus="seat-${cargo}-${seat}"`,
                    detail: `${meta.name} · 入场费 💰${cost} · 货物总收益 💰${boat.total_value}`,
                });
            }).join("")}</div>`;
            let controls = "";
            if (settingPositions) controls = `<div class="manila-move-controls"><span class="manila-position-label">起点</span><div class="manila-stepper">
                ${button("−", "position", {key: "position", disabled: !can("set_positions") || position <= 0, extra: `data-cargo="${cargo}" data-delta="-1" aria-label="${meta.name}起点减一" data-manila-focus="position-${cargo}-minus"`})}
                <output aria-label="${meta.name}起点">${position}</output>
                ${button("+", "position", {key: "position", disabled: !can("set_positions") || position >= 13, extra: `data-cargo="${cargo}" data-delta="1" aria-label="${meta.name}起点加一" data-manila-focus="position-${cargo}-plus"`})}
            </div></div>`;
            if (view.phase === "pilot" && !boat.arrived) controls = `<div class="manila-move-controls"><span class="manila-position-label">领航预览</span><div class="manila-stepper">
                ${button("−", "pilot", {key: "pilot", disabled: !pilotAllowed(cargo, delta - 1), extra: `data-cargo="${cargo}" data-delta="-1" aria-label="${meta.name}后退一格" data-manila-focus="pilot-${cargo}-minus"`})}
                <output aria-label="${meta.name}领航调整">${delta > 0 ? "+" : ""}${delta}</output>
                ${button("+", "pilot", {key: "pilot", disabled: !pilotAllowed(cargo, delta + 1), extra: `data-cargo="${cargo}" data-delta="1" aria-label="${meta.name}前进一格" data-manila-focus="pilot-${cargo}-plus"`})}
            </div></div>`;
            if (view.phase === "pirate" && view.pirate_targets?.includes(cargo)) {
                const boarding = view.pirate_day === 2;
                controls = `<div class="manila-action-buttons">${button(boarding ? "🏴‍☠️ 登船" : "🏴‍☠️ 劫掠", "pirate", {
                    key: "pirate", className: "manila-primary", disabled: !can("pirate_action") || view.current_player !== view.you || (boarding && !boat.seats.includes(null)),
                    extra: `data-cargo="${cargo}" data-manila-focus="pirate-${cargo}"`,
                })}</div>`;
            }
            return `<article class="manila-ship manila-cargo-${cargo}${preview ? " is-preview" : ""}" data-cargo="${cargo}">
                <div class="manila-ship-header"><div><div class="manila-ship-name" ${tip(`${meta.name}（${meta.icon}）· ${meta.english}`, "ship")}>${cargoLabel(cargo)}</div>
                <div class="manila-ship-status" ${tip(status, "voyage")}>${escape(status)}</div></div>
                <div class="manila-ship-value"><div ${tip(`船成功且未被劫掠时，船上工人平分 💰${boat.total_value}。`, "ship")}>收益 💰${boat.total_value}</div>
                ${boat.last_roll ? `<span ${tip(`最近一次骰子：${boat.last_roll} 点。`, "voyage")}>🎲 ${boat.last_roll}</span>` : ""}</div></div>
                <div class="manila-track" ${tip(knownPosition ? `${meta.name}在第 ${position} 格${delta ? `，包含领航预览 ${delta > 0 ? "+" : ""}${delta}` : ""}。` : `${meta.name}的起点尚未确认。`, "voyage")}>${track}</div>
                ${seats}${controls}${confirmation(`ship-${cargo}`)}</article>`;
        }).join("");
        if (settingPositions) {
            const sum = cargos.reduce((amount, cargo) => amount + positions[cargo], 0);
            byId("Boats").insertAdjacentHTML("beforeend", `<div class="manila-setup-footer"><strong>起点合计 ${sum} / 9</strong>${button("Confirm", "positions-confirm", {key: "position", className: "manila-primary", disabled: !can("set_positions") || sum !== 9})}</div>`);
        }
        if (view.phase === "pilot" && view.board?.pilots?.[activePilot()] === view.you) {
            const used = Object.values(pilotMoves).reduce((sum, delta) => sum + Math.abs(delta), 0);
            const limit = activePilot() === "big" ? 2 : 1;
            byId("Boats").insertAdjacentHTML("beforeend", `<div class="manila-setup-footer"><strong>领航 ${used} / ${limit} 格</strong>${button(used ? "Confirm" : "不移动", "pilot-confirm", {key: "pilot", className: "manila-primary", disabled: !canPilot() || !cargos.some(cargo => !view.boats[cargo]?.arrived)})}</div>`);
        }
    }

    function locationInfo(type, slot) {
        const board = view.board || {};
        if (type === "port" || type === "shipyard") {
            const index = ["A", "B", "C"].indexOf(slot);
            return {title: `${type === "port" ? "⚓ 码头" : "🛠️ 修船厂"} ${slot}`, cost: [4, 3, 2][index],
                reward: `≥${index + 1} 船${type === "port" ? "成功" : "失败"} → +${[6, 8, 15][index]}`,
                occupant: board[type]?.[slot], location: {type, slot}, key: type};
        }
        if (type === "pirate") return {title: slot === "captain" ? "🏴‍☠️ 船长" : "🏴‍☠️ 船员", cost: 5,
            reward: "登船 / 分享劫掠", occupant: board.pirates?.[slot], location: {type}, key: "pirate"};
        if (type === "pilot") return {title: slot === "big" ? "🧭 大领航" : "🧭 小领航", cost: slot === "big" ? 5 : 2,
            reward: slot === "big" ? "最多 ±2 格" : "最多 ±1 格", occupant: board.pilots?.[slot], location: {type, size: slot}, key: "pilot"};
        return {title: "🛡️ 保险", cost: 0, reward: "即得 +10 / 失败赔10", occupant: board.insurance, location: {type: "insurance"}, key: "insurance"};
    }

    function renderInvestment(type, slot) {
        const info = locationInfo(type, slot);
        const selected = selection?.key === `${type}-${slot}`;
        const name = ["port", "shipyard"].includes(type) ? slot : info.title;
        const content = `<span class="manila-investment-top"><span class="manila-investment-name">${name}${info.occupant ? ` <span class="manila-owner">👤 ${playerToken(info.occupant)}</span>` : ""}</span><span class="manila-investment-cost">💰${info.cost}</span></span>
            <span class="manila-investment-reward">${info.reward}</span>`;
        const detail = `${info.title} · 入场费 💰${info.cost} · ${info.reward}${info.occupant ? ` · ${playerName(info.occupant)}` : ""}`;
        if (info.occupant) return `<div class="manila-investment${info.occupant === view.you ? " is-you" : ""}" ${tip(detail, info.key)}>${content}</div>`;
        return button(content, "investment", {
            key: info.key, detail, className: `manila-investment${selected ? " manila-selected" : ""}`,
            disabled: !canPlace(info.cost) || (type === "pirate" && slot === "pirate" && !view.board?.pirates?.captain),
            extra: `data-location="${type}" data-slot="${slot}" data-manila-focus="${type}-${slot}"`,
        });
    }

    function renderBoard() {
        byId("HarborContext").innerHTML = (view.cargo_slots || []).filter(cargo => cargoData[cargo] && view.boats?.[cargo]).map(cargo => {
            const boat = view.boats[cargo];
            const result = boat.plundered ? boat.plunder_result === "port" ? "⚓" : "🛠️" : boat.arrived ? "⚓" : `${boat.position}/13`;
            return `<span class="manila-harbor-cargo manila-cargo-${cargo}" ${tip(`${cargoLabel(cargo)} · ${shipStatus(boat, false)}${boat.last_roll ? ` · 最近骰点 ${boat.last_roll}` : ""}`, "voyage")}>${cargoData[cargo].icon} ${result}</span>`;
        }).join("");
        byId("Board").innerHTML = ["port", "shipyard"].map(type => `<div class="manila-zone"><div class="manila-zone-heading"><strong ${tip(explanations[type][1], type)}>${type === "port" ? "⚓ 码头" : "🛠️ 修船厂"}</strong></div>
            <div class="manila-zone-slots">${["A", "B", "C"].map(slot => renderInvestment(type, slot)).join("")}</div>${confirmation(type)}</div>`).join("") +
            `<div class="manila-zone manila-zone-wide"><div class="manila-zone-heading"><strong>特殊职位</strong></div>
            <div class="manila-special-slots">${renderInvestment("pirate", "captain")}${renderInvestment("pirate", "pirate")}${renderInvestment("pilot", "big")}${renderInvestment("pilot", "small")}${renderInvestment("insurance", "broker")}</div>${confirmation("special")}</div>`;
    }
    function bidLimits() {
        return {minimum: (view.auction?.highest_bid || 0) + 1, maximum: (own()?.cash || 0) + total(own()?.stocks) * loanConfig("loan_amount", 12)};
    }

    function validBid() {
        const limits = bidLimits();
        return Number.isInteger(bidAmount) && bidAmount >= limits.minimum && bidAmount <= limits.maximum;
    }

    function renderActions() {
        const phase = view.phase;
        const acting = isOurTurn();
        byId("ActionPanel").classList.toggle("is-active", acting);
        let contents = `<div class="manila-action-title">${phaseNames[phase] || "Waiting for game"}</div>`;
        if (phase === "auction") {
            const auction = view.auction || {};
            const limits = bidLimits();
            contents += `<p class="manila-action-note">最高出价 💰${auction.highest_bid || 0}${auction.leader ? ` · ${escape(playerName(auction.leader))}` : " · 尚无人出价"}</p>`;
            if (acting) contents += `<div class="manila-bid-buttons"><label class="manila-bid-label" for="manilaBidInput"><span>出价 · 至少 💰${limits.minimum}</span>
                <span class="manila-stepper">${button("−", "bid-step", {key: "bid", disabled: !can("bid") || bidAmount <= limits.minimum, extra: 'data-delta="-1" aria-label="出价减一" data-manila-focus="bid-minus"'})}
                <input id="manilaBidInput" data-manila-focus="bid-input" type="number" inputmode="numeric" min="${limits.minimum}" max="${Math.max(limits.minimum, limits.maximum)}" step="1" value="${Number.isFinite(bidAmount) ? bidAmount : ""}" ${!can("bid") ? "disabled" : ""} ${explanation("bid")} />
                ${button("+", "bid-step", {key: "bid", disabled: !can("bid") || bidAmount >= limits.maximum, extra: 'data-delta="1" aria-label="出价加一" data-manila-focus="bid-plus"'})}</span></label></div>
                <div class="manila-action-buttons">${button("Bid", "bid", {key: "bid", className: "manila-primary", disabled: !can("bid") || !validBid(), extra: 'id="manilaBidSubmit"'})}
                ${button("Pass", "pass-bid", {key: "bid", disabled: !can("pass_bid")})}</div>
                <p id="manilaBidNotice" class="manila-small">${bidAmount > (own()?.cash || 0) ? "出价超过现金，竞得后需抵押股票。" : `可用现金 💰${own()?.cash || 0}`}</p>`;
            contents += `<div class="manila-bid-list" data-manila-scroll="auction">${(view.players || []).map(player => {
                const passed = !(auction.active || []).includes(player.player_id);
                const leader = auction.leader === player.player_id;
                return `<div class="manila-bid-row${leader ? " is-leader" : ""}${passed ? " is-passed" : ""}"><span>${escape(playerToken(player.player_id))} · ${escape(player.name || player.player_id)}</span><span>${passed ? "Pass" : `💰${auction.bids?.[player.player_id] || 0}`}</span></div>`;
            }).join("")}</div>`;
        } else if (phase === "harbormaster_pay") {
            const harborPlayer = view.players.find(player => player.player_id === view.harbormaster);
            const shortfall = Math.max(0, (view.harbormaster_bid || 0) - (harborPlayer?.cash || 0));
            contents += `<p class="manila-action-note">竞拍款 💰${view.harbormaster_bid || 0} · 尚缺 💰${shortfall}</p><p class="manila-small">${acting ? "展开抵押股票补足现金，系统自动付款。" : `等待 ${escape(playerName(view.harbormaster))} 补款。`}</p>`;
        } else if (phase === "harbormaster_buy") {
            contents += `<p class="manila-action-note">${acting ? "点击上方货物购买一张股票。" : `等待 ${escape(playerName(view.harbormaster))} 购买股票。`}</p>`;
            if (acting) contents += `<div class="manila-action-buttons">${button("Skip Buy", "skip-buy", {key: "market", disabled: !can("skip_buy")})}</div>`;
        } else if (phase === "harbormaster_cargo") {
            contents += `<p class="manila-action-note">${acting ? `已选 ${selectedCargo.length} / 3 · 点击上方货物，船只实时预览。` : `等待 ${escape(playerName(view.harbormaster))} 选择出航货物。`}</p>`;
            if (acting) contents += `<div class="manila-action-buttons">${button("Confirm", "cargo-confirm", {key: "cargo", className: "manila-primary", disabled: !can("select_cargo") || selectedCargo.length !== 3})}</div>`;
        } else if (phase === "harbormaster_position") {
            contents += `<p class="manila-action-note">${acting ? "在船旁调整起点，合计 9 格后确认。" : `等待 ${escape(playerName(view.harbormaster))} 安排三船起点。`}</p>`;
        } else if (phase === "placement") {
            const note = !acting ? `等待 ${escape(playerName(view.current_player))} 派遣。` : own().workers_available <= 0 ? "没有剩余工人，请 Pass。" : "点选船位或港湾职位，在原处确认。";
            contents = `<div class="manila-placement-line"><p class="manila-action-note">${note}</p>${acting ? button("Pass", "pass", {key: "pass", disabled: !can("pass")}) : ""}</div>`;
        } else if (phase === "pilot") {
            contents += `<p class="manila-action-note">${activePilot() === "big" ? "大领航" : "小领航"} · ${escape(playerName(view.board?.pilots?.[activePilot()]))}</p>
                <p class="manila-small">${acting ? "用船旁 + / − 预览，确认后才移动。" : "等待领航调整，随后进行最后一次掷骰。"}</p>`;
        } else if (phase === "pirate") {
            contents += `<p class="manila-action-note">第 ${view.pirate_day} 次移动 · ${view.pirate_day === 2 ? "选择船只登船" : "选择船只劫掠并决定去向"}</p>`;
            if (acting && view.pirate_day === 2) contents += `<div class="manila-action-buttons">${button("Skip", "pirate-skip", {key: "pirate", disabled: !can("pirate_action")})}</div>`;
            if (!acting) contents += `<p class="manila-small">等待 ${escape(playerName(view.current_player))}。</p>`;
        } else {
            contents += `<p class="manila-action-note">${view.game_over ? "棋盘与账本保留，重新开局请使用 Room Controls。" : "查看航次结算，所有玩家准备后继续。"}</p>`;
        }
        byId("ActionBody").innerHTML = contents;
        renderFinance();
    }

    function renderFinance() {
        const mine = own();
        const show = !!mine && !view.game_over && view.phase !== "round_end";
        visible(byId("Finance"), show);
        if (!show) return;
        const loan = loanConfig("loan_amount", 12);
        const repayment = loanConfig("loan_repay", 15);
        byId("Debt").textContent = `· 已抵押 ${total(mine.pledged)}`;
        byId("FinanceBody").innerHTML = `<p class="manila-small">每股 +💰${loan} · 终局债务 💰${repayment}</p>` + cargoOrder.map(cargo => button(`${cargoLabel(cargo)} ×${mine.stocks?.[cargo] || 0}`, "pledge", {
            key: "pledge", disabled: !can("pledge_stock") || !isOurTurn() || !(mine.stocks?.[cargo] > 0),
            extra: `data-cargo="${cargo}" data-manila-focus="pledge-${cargo}"`,
        })).join("") + confirmation("finance");
    }

    function ledgerLabel(label) {
        const fixed = {Bid: "港务长竞拍", "Harbormaster Bid": "港务长竞拍", "Pledge Loan": "抵押贷款", "Insurance Bonus": "保险收入", "Insurance Payout": "保险赔付", "Pirate Plunder": "海盗劫掠", Pirates: "海盗入场"};
        if (fixed[label]) return fixed[label];
        let translated = label.replace(/^Port /, "码头 ").replace(/^Shipyard /, "修船厂 ").replace(/^Pilot Big$/, "大领航").replace(/^Pilot Small$/, "小领航");
        cargoOrder.forEach(cargo => { translated = translated.replace(cargoData[cargo].english, cargoData[cargo].name); });
        return translated.replace(/^Buy /, "购买 ").replace(/^Seat /, "船位 ").replace(/^Ship /, "货船 ");
    }

    function renderReview() {
        const reviewing = view.phase === "round_end" || view.game_over;
        visible(byId("Review"), reviewing);
        if (!reviewing) return;
        const players = [...view.players].sort((first, second) => Number(second.player_id === view.you) - Number(first.player_id === view.you));
        const ready = players.filter(player => player.round_ready).length;
        const winners = (view.winner || []).map(playerName).join(" · ");
        const title = view.game_over ? `🏆 ${winners || "Game over"}` : `第 ${view.round} 航次 · 结算`;
        let subtitle = view.game_over ? "最终胜者 · 航次账本保留" : `${ready} / ${players.length} Ready · 所有人确认后继续`;
        if (view.game_over && own()) {
            const stockValue = cargoOrder.reduce((sum, cargo) => sum + (own().stocks?.[cargo] || 0) * (view.price_track?.[cargo] || 0), 0);
            const debt = total(own().pledged) * loanConfig("loan_repay", 15);
            subtitle = `你的资产：现金 ${own().cash} + 股票 ${stockValue} − 债务 ${debt} = ${own().cash + stockValue - debt}`;
        }
        byId("Review").innerHTML = `<div class="manila-review-heading"><div><h3>${escape(title)}</h3><span class="manila-small">${escape(subtitle)}</span></div>
            ${!view.game_over && own() ? button(own().round_ready ? "Ready ✓" : pending ? "Sending…" : "Next Round", "next-round", {key: "next", className: "manila-primary", disabled: !can("next_round")}) : ""}</div>
            <div class="manila-results" data-manila-scroll="results">${players.map(player => {
                const ledger = view.round_ledger?.[player.player_id] || {};
                const earned = total(ledger.earn);
                const spent = total(ledger.spend);
                const net = earned - spent;
                const lines = ["earn", "spend"].flatMap(kind => Object.entries(ledger[kind] || {}).map(([label, amount]) => `<div class="manila-ledger-line"><span>${escape(ledgerLabel(label))}</span><span class="${kind === "earn" ? "manila-gain" : "manila-loss"}">${kind === "earn" ? "+" : "−"}${amount}</span></div>`)).join("");
                return `<article class="manila-result-card${player.player_id === view.you ? " is-you" : ""}"><div class="manila-result-name">${escape(playerToken(player.player_id))} · ${escape(player.name || player.player_id)}</div>
                    <div class="manila-result-total" ${tip(`本航次收入 💰${earned}，支出 💰${spent}，净额 ${net >= 0 ? "+" : ""}${net}。`, "result")}><span>净额</span><strong class="${net >= 0 ? "manila-gain" : "manila-loss"}">${net >= 0 ? "+" : "−"}💰${Math.abs(net)}</strong></div>
                    <div class="manila-result-total"><span ${tip(`当前现金 💰${player.cash}`, "cash")}>💰 ${player.cash}</span><span>${view.game_over ? view.winner?.includes(player.player_id) ? "🏆 Winner" : "Finished" : player.round_ready ? "Ready ✓" : "Waiting"}</span></div>
                    <details data-manila-detail-id="ledger-${escape(player.player_id)}"><summary>Details · +${earned} / −${spent}</summary>${lines || '<p class="manila-small">No transactions</p>'}</details></article>`;
            }).join("")}</div>`;
    }

    function renderPlayers() {
        byId("PlayerCount").textContent = `· ${view.players.length}`;
        byId("Players").innerHTML = view.players.map(player => {
            const mine = player.player_id === view.you;
            const stocks = mine ? total(player.stocks) : player.stock_count || 0;
            const pledged = mine ? total(player.pledged) : player.pledged_count || 0;
            return `<article class="manila-player${mine ? " is-you" : ""}"><strong>${escape(playerToken(player.player_id))} · ${escape(player.name || player.player_id)}${player.player_id === view.harbormaster ? " · 港务长" : ""}</strong>
                <div class="manila-player-resources"><span ${tip(`现金 💰${player.cash}`, "cash")}>💰${player.cash}</span><span ${tip(`工人剩余 ${player.workers_available} / ${player.workers_total}`, "workers")}>👤${player.workers_available}/${player.workers_total}</span><span ${tip(`股票 ${stocks} 张；${mine ? "自己的各类持股见上方市场。" : "种类保密。"}`, "market")}>📜${stocks}${mine ? "" : " 🔒"}</span><span ${tip(`已抵押 ${pledged} 张股票`, "pledge")}>🏦${pledged}</span></div></article>`;
        }).join("");
    }

    function renderStatus() {
        const stage = view.phase === "auction" ? 0 : view.phase?.startsWith("harbormaster_") ? 1 : view.phase === "round_end" || view.game_over ? 3 : 2;
        byId("RoundLabel").textContent = `第 ${view.round} 航次`;
        byId("Stages").innerHTML = ["拍卖", "备航", "出航", "结算"].map((label, index) => `<li class="${index === stage ? "is-current" : index < stage ? "is-done" : ""}"${index === stage ? ' aria-current="step"' : ""}>${label}</li>`).join("");
        const phase = phaseNames[view.phase] || "Waiting";
        byId("Turn").textContent = !connected() ? "Disconnected · Reconnect to continue" : pending ? "Sending…" : view.game_over ? "航程结束" : view.phase === "round_end" ? "结算时间 · 不急，先看账本" : isOurTurn() ? `轮到你 · ${phase}` : `${own() ? "等待" : "Spectating ·"} ${playerName(view.current_player || view.harbormaster)} · ${phase}`;
        byId("Activity").textContent = lastActivity || (view.harbormaster ? `港务长 ${playerName(view.harbormaster)} · 竞拍 💰${view.harbormaster_bid || 0}` : "竞选港务长，决定这一航次的航线");
        byId("Wallet").innerHTML = own() ? `<span ${tip(`你的可用现金 💰${own().cash}`, "cash")}>💰 ${own().cash}</span><span ${tip(`你的工人：剩余 ${own().workers_available} / 共 ${own().workers_total}`, "workers")}>👤 ${own().workers_available}/${own().workers_total}</span>` : `<span ${tip("旁观者只能查看公开信息，不能行动。")}>Spectator</span>`;
        byId("FacilitiesResources").textContent = own() ? `💰 ${own().cash} · 👤 ${own().workers_available}` : "入场费 / 收益";
        byId("FacilitiesResources").dataset.manilaTip = own() ? `可用现金 💰${own().cash} · 剩余工人 ${own().workers_available}；确认投资前可以在这里查看。` : "入场费在上方，收益和条件在下方。";
        document.body.classList.toggle("manila-turn-active", isOurTurn() && connected());
    }

    function render() {
        if (!view) return;
        hideTip();
        const focused = document.activeElement?.dataset.manilaFocus;
        const openDetails = new Set([...panel.querySelectorAll("details[open][data-manila-detail-id]")].map(node => node.dataset.manilaDetailId));
        const scrollPositions = [...panel.querySelectorAll("[data-manila-scroll]")].map(node => [node.dataset.manilaScroll, node.scrollTop]);
        renderStatus();
        renderMarket();
        renderBoats();
        renderBoard();
        renderActions();
        renderReview();
        renderPlayers();
        panel.querySelectorAll("details[data-manila-detail-id]").forEach(node => { node.open = openDetails.has(node.dataset.manilaDetailId); });
        scrollPositions.forEach(([key, top]) => {
            const node = panel.querySelector(`[data-manila-scroll="${CSS.escape(key)}"]`);
            if (node) node.scrollTop = top;
        });
        if (focused) panel.querySelector(`[data-manila-focus="${CSS.escape(focused)}"]`)?.focus({preventScroll: true});
    }
    function clearSelection() {
        const origin = selection?.origin;
        const changed = selection || selectedCargo.length || Object.values(pilotMoves).some(Boolean);
        selection = null;
        selectedCargo = [];
        pilotMoves = {};
        if (changed) render();
        if (origin) panel.querySelector(`[data-manila-focus="${CSS.escape(origin)}"]`)?.focus({preventScroll: true});
    }

    function select(next, source) {
        selection = selection?.key === next.key ? null : {...next, origin: source.dataset.manilaFocus};
        hideTip();
        setError();
        render();
    }

    function handleOperation(target) {
        const operation = target.dataset.manilaOp;
        const cargo = target.dataset.cargo;
        if (target.disabled || explaining) return;
        if (operation === "cancel") { clearSelection(); return; }
        if (pending) return;
        if (operation === "confirm" && selection) { dispatch(selection.action); return; }
        if (operation === "destination" && selection?.kind === "plunder") {
            selection.action.result = target.dataset.result;
            render();
        } else if (operation === "bid-step" && can("bid")) {
            const limits = bidLimits();
            bidAmount = Math.max(limits.minimum, Math.min(limits.maximum, (Number.isInteger(bidAmount) ? bidAmount : limits.minimum) + Number(target.dataset.delta)));
            render();
        } else if (operation === "bid" && can("bid") && validBid()) {
            dispatch({type: "bid", amount: bidAmount});
        } else if (operation === "pass-bid") {
            dispatch({type: "pass_bid"});
        } else if (operation === "skip-buy") {
            dispatch({type: "skip_buy"});
        } else if (operation === "buy" && can("buy_stock") && cargoData[cargo]) {
            const price = Math.max(5, view.price_track?.[cargo] || 0);
            if (own().cash < price) return;
            select({key: `buy-${cargo}`, host: "market", title: `购买 ${cargoLabel(cargo)}`, note: `支付 💰${price} · 买入 1 张股票 · 余额 💰${own().cash - price}`, action: {type: "buy_stock", cargo}}, target);
        } else if (operation === "cargo" && can("select_cargo") && cargoData[cargo]) {
            if (selectedCargo.includes(cargo)) selectedCargo = selectedCargo.filter(item => item !== cargo);
            else if (selectedCargo.length < 3) selectedCargo.push(cargo);
            render();
        } else if (operation === "cargo-confirm" && selectedCargo.length === 3) {
            dispatch({type: "select_cargo", cargo: [...selectedCargo]});
        } else if (operation === "position" && can("set_positions")) {
            positions[cargo] = Math.max(0, Math.min(13, positions[cargo] + Number(target.dataset.delta)));
            render();
        } else if (operation === "positions-confirm") {
            const draft = view.cargo_slots.map(item => positions[item]);
            if (draft.every(Number.isInteger) && total(draft) === 9) dispatch({type: "set_positions", positions: draft});
        } else if (operation === "seat" && cargoData[cargo]) {
            const seat = Number(target.dataset.seat);
            const boat = view.boats[cargo];
            const cost = boat.seat_costs[seat];
            if (!canPlace(cost) || boat.seats[seat] || boat.plundered) return;
            select({key: `seat-${cargo}-${seat}`, host: `ship-${cargo}`, title: `${cargoLabel(cargo)} · 座位 ${seat + 1}`,
                note: `支付 💰${cost} + 1 名工人 · 成功后分享 💰${boat.total_value}`, action: {type: "place_worker", location: {type: "ship", cargo, seat}}}, target);
        } else if (operation === "investment") {
            const type = target.dataset.location;
            const slot = target.dataset.slot;
            const info = locationInfo(type, slot);
            if (!canPlace(info.cost) || info.occupant || (type === "pirate" && slot === "pirate" && !view.board.pirates.captain)) return;
            select({key: `${type}-${slot}`, host: ["port", "shipyard"].includes(type) ? type : "special", title: info.title,
                note: `支付 💰${info.cost} + 1 名工人 · ${info.reward}`, action: {type: "place_worker", location: info.location}}, target);
        } else if (operation === "pass") {
            dispatch({type: "pass"});
        } else if (operation === "pledge" && can("pledge_stock") && isOurTurn() && own().stocks?.[cargo] > 0) {
            select({key: `pledge-${cargo}`, host: "finance", title: `抵押 ${cargoLabel(cargo)} ×1`,
                note: `即得 💰${loanConfig("loan_amount", 12)} · 终局扣 💰${loanConfig("loan_repay", 15)} · 不可赎回`, action: {type: "pledge_stock", cargo}}, target);
        } else if (operation === "pilot") {
            const next = (pilotMoves[cargo] || 0) + Number(target.dataset.delta);
            if (pilotAllowed(cargo, next)) { pilotMoves[cargo] = next; render(); }
        } else if (operation === "pilot-confirm" && canPilot()) {
            const moves = Object.entries(pilotMoves).filter(([, delta]) => delta !== 0);
            const size = activePilot();
            if (moves.length === 2 && size === "big") {
                dispatch({type: "pilot_split", size, cargo_a: moves[0][0], delta_a: moves[0][1], cargo_b: moves[1][0], delta_b: moves[1][1]});
            } else {
                const chosen = moves[0] || [view.cargo_slots.find(item => !view.boats[item].arrived), 0];
                if (chosen[0]) dispatch({type: "pilot_move", size, cargo: chosen[0], delta: chosen[1]});
            }
        } else if (operation === "pirate" && can("pirate_action") && view.current_player === view.you && view.pirate_targets.includes(cargo)) {
            const boarding = view.pirate_day === 2;
            if (boarding && !view.boats[cargo].seats.includes(null)) return;
            select({key: `pirate-${cargo}`, host: `ship-${cargo}`, kind: boarding ? "board" : "plunder", title: `${boarding ? "登船" : "劫掠"} · ${cargoLabel(cargo)}`,
                note: boarding ? "海盗离开原职位，占据船上一个空位。" : `分享货物 💰${view.boats[cargo].total_value}，选择该船的结算去向。`,
                action: boarding ? {type: "pirate_action", mode: "board", cargo} : {type: "pirate_action", mode: "plunder", cargo, result: "port"}}, target);
        } else if (operation === "pirate-skip") {
            dispatch({type: "pirate_action", mode: "skip"});
        } else if (operation === "next-round") {
            dispatch({type: "next_round"});
        }
    }

    function captureActivity(previous, next) {
        if (!previous || previous.round !== next.round) { lastActivity = ""; return; }
        const moves = [];
        Object.entries(next.boats || {}).forEach(([cargo, boat]) => {
            const before = previous.boats?.[cargo];
            if (before && before.position !== boat.position) moves.push(`${cargoLabel(cargo)} ${before.position} → ${boat.position}`);
        });
        if (moves.length) { lastActivity = moves.join(" · "); return; }
        for (const [cargo, boat] of Object.entries(next.boats || {})) {
            const before = previous.boats?.[cargo];
            const seat = boat.seats.findIndex((occupant, index) => occupant && occupant !== before?.seats[index]);
            if (seat !== -1) { lastActivity = `${playerName(boat.seats[seat])} → ${cargoLabel(cargo)} · 座位 ${seat + 1}`; return; }
        }
        for (const [type, title] of [["port", "⚓ 码头"], ["shipyard", "🛠️ 修船厂"], ["pirates", "🏴‍☠️ 海盗"], ["pilots", "🧭 领航"]]) {
            for (const [slot, occupant] of Object.entries(next.board?.[type] || {})) {
                if (occupant && occupant !== previous.board?.[type]?.[slot]) { lastActivity = `${playerName(occupant)} → ${title}${["A", "B", "C"].includes(slot) ? ` ${slot}` : ""}`; return; }
            }
        }
        if (next.board?.insurance && next.board.insurance !== previous.board?.insurance) { lastActivity = `${playerName(next.board.insurance)} → 🛡️ 保险`; return; }
        if ((next.auction?.highest_bid || 0) > (previous.auction?.highest_bid || 0)) { lastActivity = `${playerName(next.auction.leader)} 出价 💰${next.auction.highest_bid}`; return; }
        if (next.current_player !== previous.current_player && previous.phase === "placement" && next.phase === "placement") lastActivity = `${playerName(previous.current_player)} · Pass`;
    }

    function clearState() {
        view = null;
        roomKey = null;
        stateSignature = "";
        contextKey = "";
        selection = null;
        selectedCargo = [];
        positions = {};
        pilotMoves = {};
        bidAmount = null;
        pending = false;
        pointer = null;
        lastActivity = "";
        setExplain(false);
        hideTip();
        setError();
        [helpDialog, explainDialog].forEach(dialog => { if (dialog.open) dialog.close(); });
        document.body.classList.remove("manila-turn-active");
        ["Market", "Stages", "Wallet", "ActionBody", "Board", "HarborContext", "Players", "Review", "FinanceBody"].forEach(id => byId(id).replaceChildren());
        byId("Boats").innerHTML = '<div class="manila-empty">Waiting for game</div>';
        byId("RoundLabel").textContent = "等待启航";
        byId("Turn").textContent = "Waiting for game";
        byId("Activity").textContent = "";
        byId("PlayerCount").textContent = "";
        byId("Finance").open = false;
        byId("PlayersDetails").open = false;
        visible(byId("Finance"), false);
        visible(byId("Review"), false);
    }

    window.renderManilaGameState = data => {
        if (!data?.view) return;
        if (typeof currentGameType !== "undefined" && currentGameType !== "manila") {
            currentGameType = "manila";
            setGamePanelVisibility("manila");
        }
        const next = data.view;
        const nextSignature = JSON.stringify(next);
        const nextContext = JSON.stringify([data.room_id, next.you, next.round, next.phase, next.current_player, next.pending_pilots, next.pirate_targets, next.cargo_slots]);
        if (roomKey !== data.room_id || view?.you !== next.you) clearState();
        const changed = nextSignature !== stateSignature;
        if (changed) {
            captureActivity(view, next);
            pending = false;
            selection = null;
            hideTip();
            setError();
        }
        view = next;
        roomKey = data.room_id;
        if (nextContext !== contextKey) {
            selectedCargo = [];
            pilotMoves = {};
            positions = Object.fromEntries((view.cargo_slots || []).map(cargo => [cargo, 3]));
            bidAmount = (view.auction?.highest_bid || 0) + 1;
            byId("Finance").open = view.phase === "harbormaster_pay" && view.harbormaster === view.you;
            contextKey = nextContext;
        }
        stateSignature = nextSignature;
        render();
    };
    window.clearManilaState = clearState;
    window.showManilaHeaderActions = show => {
        header.style.display = show ? "flex" : "none";
        if (!show) clearState();
    };

    panel.addEventListener("click", event => {
        if (explaining || event.defaultPrevented) return;
        const target = event.target.closest("[data-manila-op]");
        if (target) { hideTip(); handleOperation(target); return; }
        if (event.target.closest("button, input, select, summary, a, .manila-confirm, [data-manila-tip]")) return;
        clearSelection();
    });
    panel.addEventListener("input", event => {
        if (event.target.id !== "manilaBidInput") return;
        bidAmount = event.target.value === "" ? null : Number(event.target.value);
        byId("BidSubmit").disabled = !can("bid") || !validBid();
        byId("BidNotice").textContent = !validBid() ? "请输入高于当前出价、且现金与可抵押股票足以支付的整数。" : bidAmount > own().cash ? "出价超过现金，竞得后需抵押股票。" : `可用现金 💰${own().cash}`;
    });
    byId("HelpBody").innerHTML = help;
    byId("HelpBtn").addEventListener("click", () => { setExplain(false); openDialog(helpDialog); });
    byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
    byId("HelpClose").addEventListener("click", () => helpDialog.close());
    byId("ExplainClose").addEventListener("click", () => explainDialog.close());
    [helpDialog, explainDialog].forEach(dialog => {
        dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus({preventScroll: true}); });
        dialog.addEventListener("click", event => {
            const bounds = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
        });
    });

    const active = () => typeof currentGameType !== "undefined" && currentGameType === "manila" && !panel.classList.contains("hidden");
    const exempt = target => !!target.closest("#manilaHelpBtn, #manilaExplainBtn, .manila-dialog, #roomControlsToggleBtn, #roomControlsCollapseBtn");
    document.addEventListener("pointerdown", event => {
        if (!active() || exempt(event.target) || helpDialog.open || explainDialog.open) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-manila-explain]");
        pointer = {id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, explaining,
            explainTarget: target && panel.contains(target) ? target : null, target: event.target, type: event.pointerType};
    }, true);
    document.addEventListener("pointermove", event => {
        if (!pointer || event.pointerId !== pointer.id) return;
        if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 8) {
            pointer.moved = true;
            hideTip();
        }
    }, true);
    document.addEventListener("pointerup", event => {
        if (!pointer || event.pointerId !== pointer.id) return;
        const gesture = pointer;
        pointer = null;
        if (gesture.moved) { suppressClickUntil = performance.now() + 650; return; }
        if (gesture.explaining) {
            event.preventDefault();
            event.stopImmediatePropagation();
            suppressClickUntil = performance.now() + 650;
            if (gesture.explainTarget) showExplanation(gesture.explainTarget);
        } else if (gesture.type !== "mouse" && panel.contains(gesture.target)) {
            const target = gesture.target.closest("[data-manila-tip]");
            if (target) showTip(target, true);
        }
    }, true);
    document.addEventListener("pointercancel", event => {
        if (pointer?.id === event.pointerId) { pointer = null; suppressClickUntil = performance.now() + 650; hideTip(); }
    }, true);
    document.addEventListener("click", event => {
        if (!active() || exempt(event.target)) return;
        if (explaining || performance.now() < suppressClickUntil) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (explaining && event.detail === 0) showExplanation(event.target.closest("[data-manila-explain]"));
        }
    }, true);
    panel.addEventListener("pointerover", event => {
        if (event.pointerType === "mouse") showTip(event.target.closest("[data-manila-tip]"));
    });
    panel.addEventListener("pointerout", event => {
        if (event.pointerType === "mouse" && tipTarget && !tipTarget.contains(event.relatedTarget)) hideTip();
    });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-manila-tip]"), true));
    panel.addEventListener("focusout", hideTip);
    document.addEventListener("scroll", () => {
        hideTip();
        if (pointer) pointer.moved = true;
    }, true);
    window.addEventListener("resize", hideTip);
    document.addEventListener("keydown", event => {
        if (!active()) return;
        if (event.key === "Escape") {
            setExplain(false);
            hideTip();
            if (!helpDialog.open && !explainDialog.open) clearSelection();
        } else if (explaining && ["Enter", " "].includes(event.key) && !exempt(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            showExplanation(event.target.closest("[data-manila-explain]"));
        }
    }, true);

    function syncRoom(state) {
        if (!state || state.game_type !== "manila" || state.status === "lobby") {
            if (view) clearState();
            return;
        }
        if (view && roomKey !== state.room_id) clearState();
    }

    function initialize() {
        byId("HelpBtn").setAttribute("aria-label", "Help");
        byId("ExplainBtn").setAttribute("aria-label", "Explain");
        setExplain(false);
        socket.on("room:state", syncRoom);
        socket.on("system:error", data => {
            if (!active() || !view) return;
            pending = false;
            selection = null;
            render();
            setError(typeof data === "string" ? data : data?.message || "Action failed. Please try again.");
        });
        socket.on("disconnect", () => {
            if (!view) return;
            pending = false;
            selection = null;
            selectedCargo = [];
            pilotMoves = {};
            render();
        });
        socket.on("connect", () => { if (view && active()) render(); });
        socket.on("system:info", data => {
            if (view && active() && data?.room_id === roomKey && data?.player_id === view.you) render();
        });
        socket.on("room:session_replaced", () => {
            if (view && active()) { pending = false; selection = null; render(); }
        });
        if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "manila" &&
            (!currentRoomState || currentRoomState.room_id === lastGameStatePayload.room_id)) window.renderManilaGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, {once: true});
    else initialize();
})();
