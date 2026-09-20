(() => {
    "use strict";

    const panel = document.getElementById("gizmosPanel");
    const byId = name => document.getElementById(`gizmos${name}`);
    const colors = ["red", "yellow", "blue", "black"];
    const energy = {
        red: ["🔴", "Heat", "热能"], yellow: ["🟡", "Electric", "电能"],
        blue: ["🔵", "Atomic", "原子能"], black: ["⚫", "Battery", "电池能"],
        generic: ["🌈", "Any", "任意颜色"],
    };
    const panels = { file: "🗂️ 归档", pick: "🫳 取能量", build: "🛠️ 建造", converter: "🔁 转换器", upgrade: "➕ 升级", generic: "✨ 特殊" };
    const actionNames = { pick: "Pick · 取能量", file: "File · 归档", build: "Build · 建造", research: "Research · 研究" };
    const actionTips = {
        pick: "Pick（🫳 取能量）：从公共能量中拿 1 颗，放入自己的储能区。匹配的取能量装置可以触发。",
        file: "File（🗂️ 归档）：把一张市场卡保留在自己的档案中，不支付建造费用。以后再用一个建造行动启动它。",
        build: "Build（🛠️ 建造）：支付能量，启动市场或档案中的装置。绿色标记表示目前可以建造；费用和转换器会自动结算。",
        research: "Research（🔍 研究）：选一个等级，查看至多等于研究力的卡。建造或归档其中 1 张，也可以全部放回。",
    };
    let view = null;
    let roomKey = null;
    let version = null;
    let mode = "pick";
    let marketSource = "display";
    let level = 1;
    let selection = null;
    let pickedColor = null;
    let researchOrder = [];
    let pending = false;
    let pendingTimer = null;
    let explaining = false;
    let suppressClick = false;
    let suppressTimer = null;
    let tooltipTarget = null;
    let tooltipTimer = null;
    let returnFocus = null;
    let history = [];
    let lastBotAction = "";
    let cardCatalog = new Map();
    const openPlayers = new Set();
    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const self = () => view?.players.find(player => player.player_id === view.you);
    const playerName = id => view?.players.find(player => player.player_id === id)?.name || "Player";
    const isTurn = () => !!view && view.current_turn === view.you && !view.game_over;
    const can = action => !pending && !!view?.legal_actions.includes(action);
    const activeCards = player => Object.values(player?.active || {}).flat();
    const energyName = color => energy[color] ? `${energy[color][1]}（${energy[color][0]} ${energy[color][2]}）` : color;
    const icons = list => (list || colors).map(color => energy[color]?.[0] || "").join(" / ");
    const allCards = () => [...Object.values(view?.display || {}).flat().filter(Boolean), ...(self()?.archive || []), ...(view?.prompt?.research?.cards || [])];
    const attributes = tip => `data-gizmos-tip="${esc(tip)}" data-gizmos-explain="${esc(tip)}"`;
    const info = (label, tip, className = "") => `<button type="button" class="gizmos-info ${className}" data-ui="tip" ${attributes(tip)} aria-label="${esc(tip)}">${label}</button>`;
    const control = (label, ui, { disabled = false, tip = "", extra = "", className = "", key = ui } = {}) =>
        `<button type="button" class="gizmos-control ${className}" data-ui="${ui}" data-focus="${esc(key)}" ${tip ? attributes(tip) : ""} ${extra} ${disabled ? "disabled" : ""}>${label}</button>`;

    const helpHTML = `
        <h3>从第一回合开始</h3>
        <ol><li>每回合先做 <strong>1 个基础行动</strong>：Pick（🫳 取能量）、File（🗂️ 归档）、Build（🛠️ 建造）或 Research（🔍 研究）。先点行动入口，再选能量／卡牌，最后确认。</li>
        <li>没有能量时，可以先取能量；也可以归档一张想建的卡，触发初始装置，抽取随机能量。</li>
        <li>例如：归档卡牌 → 初始装置触发 → 点击 Resolve → 抽 1 颗随机能量。联动结束后自动轮到下一位。</li></ol>
        <h3>四个行动</h3>
        <ul>${Object.values(actionTips).map(tip => `<li>${tip}</li>`).join("")}</ul>
        <h3>能量与费用</h3>
        <p>${colors.map(energyName).join("、")}。Any（🌈）表示任意颜色。Storage（📦）是储能上限；满了就不能再取能量。卡上的 Cost 是印刷费用；升级折扣和 Converter（🔁 转换器）在确认建造时自动结算。以卡上的「可建造」为准。</p>
        <h3>连锁怎么结算</h3>
        <p>触发后，主界面会列出本次可结算的装置。可以决定结算顺序；同一装置每回合最多使用一次。灰色效果当前无法执行，可在 Explain 中查看原因。额外取能量、归档、研究或免费建造不是新的基础行动。End chain 会放弃剩余可选效果。</p>
        <p>「联动参考」只列出与所选行动相关的装置，未扣除本回合已经使用的装置；实际能触发哪些，以结算区为准。</p>
        <h3>研究与归档</h3>
        <p>Research（🔍 研究）先选等级，再保留 1 张：Build 建造需能支付费用；File 归档需有空位且未被装置禁用。Return all 可以全不留。用 Earlier / Later 调整放回顺序：第 1 张放到牌库最底部。研究选牌只对当前研究者可见。档案和储存的能量在此版本中公开。</p>
        <h3>计分与结束</h3>
        <p>Points（⭐）是卡牌分数与 VP tokens（🏅 分数标记）之和；Projected（🏁）还包括当前可见的终局奖励。有人拥有 16 个装置（含初始装置），或 4 个 Level 3（三级）装置，触发最后一轮。补完该轮后比较最终分数，结果会保留供查看。</p>
        <h3>查看与操作</h3>
        <p>卡面上方是费用与分数，中间依次是「什么时候触发 → 得到什么」。Your machine 显示已建装置；Table 展开后可看对手的公开装置和档案。🤖 表示 AI。Activity 保留最近的行动记录。</p>
        <p>鼠标悬停图标可查看说明；手机点击图标或 ⓘ，浮动说明会在 3 秒后消失。再次点击其他说明会替换内容。点击空白或按 Esc 取消选择。Explain 模式下，点击灰色按钮也可查看说明，不会执行行动；Esc 退出。对话框同样支持 Esc。</p>
        <p class="gizmos-note">此版本使用近似官方的卡池，并非官方卡牌的逐张复刻。</p>`;

    function effectText(effect, fallback = "") {
        if (!effect) return fallback;
        const n = Number(effect.amount || 1);
        const source = energy[effect.source]?.[0] || "";
        const labels = {
            draw_random: `随机抽 ${n} 颗能量`, pick_energy: `取 ${n} 颗${effect.colors?.length < 4 ? ` ${icons(effect.colors)}` : "任意"}能量`,
            gain_vp: `获得 ${n} 分`, perform_file: "额外归档 1 张卡", perform_research: "额外研究 1 次", free_build_level1: "免费建造 1 个一级装置",
            upgrade_storage: `储能上限 +${n}`, upgrade_file: `档案上限 +${n}`, upgrade_research: `研究力 +${n}`,
            upgrade_disable_file: "之后不能归档", upgrade_disable_research: "之后不能研究", discount_level2: `二级建造费用 −${n}`,
            discount_archive: `从档案建造费用 −${n}`, discount_research: `研究建造费用 −${n}`, extra_score_storage: "终局按储存能量计分",
            extra_score_tokens: "终局按分数标记计分", convert_specific_to_any: `${source} 可当任意颜色`, convert_any_to_any: "1 颗能量可改为任意颜色",
            convert_specific_to_double: `1 颗 ${source} 抵 2 颗 ${source}`, convert_specific_up_to_two_to_any: `1–2 颗 ${source} 可改为任意颜色`,
            convert_each_specific_to_double: `${icons(effect.sources)} 各可将 1 颗抵 2 颗`,
        };
        return labels[effect.kind] || fallback || effect.kind;
    }

    function triggerText(card) {
        const trigger = card.trigger;
        if (!trigger) return card.panel === "converter" ? "支付建造费用时" : card.panel === "upgrade" ? "建造后持续生效" : "建造时 / 终局";
        return ({ on_file: "归档后", on_pick: `取 ${icons(trigger.colors)} 后`, on_build: `建造 ${icons(trigger.colors)} 后`,
            on_build_from_archive: "从档案建造后", on_build_level: `建造 ${trigger.level} 级后` })[trigger.kind] || "触发时";
    }

    function cardDescription(card) {
        return `${panels[card.panel] || card.panel} · Level ${card.level}（等级）；Cost ${card.cost} ${energyName(card.energy_type)}；Points（⭐）${card.vp}。${triggerText(card)}：${effectText(card.effect, card.text)}`;
    }

    function fileReason() {
        const you = self();
        if (!you?.can_file) return "装置效果已禁用归档";
        if ((you.archive || []).length >= you.file_limit) return `档案已满（${you.file_limit}/${you.file_limit}）`;
        return "当前不能归档";
    }

    function unavailableReason(action) {
        if (pending) return "正在等待行动确认";
        if (view?.game_over) return "本局已结束";
        if (!isTurn()) return `等待 ${playerName(view?.current_turn)} 行动`;
        if (view.phase !== "action") return "先完成当前连锁 / 研究";
        const you = self();
        if (action === "pick") return (you?.storage.length >= you?.storage_limit) ? "储能已满，先建造腾出空间" : "公共能量暂时为空";
        if (action === "file") return fileReason();
        if (action === "build") return "能量 / 转换器不足，可先取能量";
        if (action === "research") return you?.can_research ? "研究牌库已空" : "装置效果已禁用研究";
        return "当前不可用";
    }

    function actionAvailable(action) {
        if (view?.phase !== "action") return false;
        return action === "build" ? can("build_display") || can("build_archive") : can({ pick: "pick_energy", file: "file_display", research: "research" }[action]);
    }

    function cardCanBuild(card, source) {
        return card.buildable && (source === "research" ? can("resolve_research") : can(`build_${source}`));
    }

    function cardCanFile(source) {
        if (source === "display") return can("file_display");
        const you = self();
        return source === "research" && can("resolve_research") && you?.can_file && you.archive.length < you.file_limit;
    }

    function relatedCards(kind, color, card, source) {
        return activeCards(self()).filter(entry => {
            const trigger = entry.trigger;
            if (!trigger) return false;
            if (kind === "file") return trigger.kind === "on_file";
            if (kind === "pick") return trigger.kind === "on_pick" && (trigger.colors || []).includes(color);
            if (kind !== "build") return false;
            if (trigger.kind === "on_build_from_archive") return source === "archive";
            if (trigger.kind === "on_build_level") return trigger.level === card?.level;
            return trigger.kind === "on_build" && (card?.energy_type === "generic" || (trigger.colors || []).includes(card?.energy_type));
        });
    }

    function relatedHTML(kind, color, card, source) {
        const matches = relatedCards(kind, color, card, source);
        if (!matches.length) return "";
        const text = matches.slice(0, 2).map(item => effectText(item.effect, item.text)).join("；");
        return `<p class="gizmos-related">⚡ 联动参考：${esc(text)}${matches.length > 2 ? `，另 ${matches.length - 2} 个` : ""}${info("ⓘ", "⚡ 联动参考：这些装置的触发条件匹配所选行动。每回合只能用一次；最终以结算区的可用效果为准。")}</p>`;
    }

    function resourceHTML(player, compact = false) {
        return colors.map(color => {
            const count = player.storage.filter(item => item === color).length;
            const [icon, name] = energy[color];
            return info(`<span class="gizmos-orb color-${color}">${icon}</span><span>${compact ? "" : `<small>${name}</small>`}<strong>${count}</strong></span>`, `${energyName(color)}：${player.name} 储存 ${count} 颗，用于支付相应颜色的建造费用。`, "gizmos-resource");
        }).join("");
    }

    function renderHeader() {
        const you = self();
        if (!you) return;
        byId("Standing").innerHTML = view.players.map(player => `<span class="gizmos-standing-player ${player.player_id === view.current_turn ? "is-current" : ""}"><span>${esc(player.name)}${player.is_bot ? " · AI" : player.player_id === view.you ? " · You" : ""}</span>${info(`<strong>${player.projected_score}<small> points</small></strong>`, `Projected（🏁 预估总分）：${player.name} 当前含终局奖励的总分为 ${player.projected_score}。${player.is_bot ? "AI 表示机器人玩家。" : ""}`)}</span>`).join("");
        byId("Resources").innerHTML = `<span class="gizmos-resource-label">Your energy</span><div class="gizmos-resource-colors">${resourceHTML(you)}</div><div class="gizmos-capacities">
            ${info(`📦 <strong>${you.storage.length}/${you.storage_limit}</strong>`, "Storage（📦 储能）：当前颗数 / 上限。储能满时不能再取能量。")}
            ${info(`🗂️ <strong>${you.archive.length}/${you.file_limit}</strong>`, "Archive（🗂️ 档案）：已保留卡数 / 上限。档案满时不能归档，建造其中的卡可以腾出空位。")}
            ${info(`🔍 <strong>${you.research_amount}</strong>`, "Research（🔍 研究力）：研究时最多查看的卡牌数量。")}
            ${info(`⭐ <strong>${you.score_now}</strong>`, `Points（⭐ 分数）：卡牌分数和 VP tokens（🏅 分数标记）合计 ${you.score_now}；其中分数标记 ${you.vp_tokens_total}。含终局奖励的 Projected（🏁 预估总分）为 ${you.projected_score}。`)}
            </div>`;
    }

    function renderGuide() {
        const phase = view.phase;
        const ctx = view.prompt?.bonus_context;
        let title = "你的回合 · 选择一个行动";
        let text = "先点下方行动，再选能量或卡牌。每回合只做一个基础行动。";
        let step = 0;
        if (view.game_over) {
            title = `🏁 ${view.winner.map(playerName).join("、") || "本局"}${view.winner.length ? " 获胜" : "结束"}`;
            text = "最终分数与装置保留在下方，可展开查看。";
            step = 2;
        } else if (pending) {
            title = "正在确认你的行动…";
            text = "收到结果后会自动显示下一步。";
        } else if (!isTurn()) {
            const actor = view.players.find(player => player.player_id === view.current_turn);
            title = `${actor?.is_bot ? "🤖" : "⏳"} ${playerName(view.current_turn)} 的回合`;
            text = phase === "action" ? "可以先查看市场与自己的装置，等对方完成行动。" : "对方正在完成连锁 / 研究，结束后自动继续。";
            step = 2;
        } else if (phase === "choose_effect") {
            const effects = view.prompt.pending_effects || [];
            title = `⚡ 连锁触发 · 还有 ${effects.length} 个效果`;
            text = "点击 Resolve 结算一个效果，再跟随下一步提示；End chain 会跳过剩余效果。";
            step = 1;
        } else if (phase === "bonus_action") {
            title = "⚡ 继续完成额外行动";
            text = ({ pick: `再取 ${ctx?.remaining || 1} 颗能量：点亮起的颜色，再确认。`, file: "从市场选择一张卡归档；不消耗新的基础行动。", research: "在下面选择研究等级。", build_free_level1: "从市场或档案选一个一级装置，免费建造。" })[ctx?.kind] || "完成当前效果后继续结算。";
            step = 1;
        } else if (phase === "research") {
            title = "🔍 研究结果 · 最多保留 1 张";
            text = cardCanFile("research") ? "选一张卡建造或归档，也可以全部放回。放回顺序从左到右，第一张最深。" : `${fileReason()}：可以建造一张，或全部放回。第一张放到牌库最底部。`;
            step = 1;
        } else if (pickedColor) {
            title = `准备取 ${energyName(pickedColor)}`;
            text = "点击能量区的确认按钮；点空白可重新选择。";
        } else if (selection) {
            title = "卡牌已选中 · 在卡下确认";
            text = "Build 支付能量并启动装置；File 只保留卡牌，之后再建造。";
        } else if (mode === "research") {
            title = "研究 · 先选择等级";
            text = `将查看至多 ${self()?.research_amount || 0} 张卡；高等级通常需要更多建造能量。`;
        } else if (mode === "file") {
            title = "归档 · 选择想留到以后的卡";
            text = "卡牌不会立即生效；归档后，可以继续结算匹配的归档装置。";
        } else if (mode === "build") {
            title = "建造 · 寻找绿色「可建造」标记";
            text = "市场或档案都可以选；建造后，装置会加入右侧的机器。";
        } else if (!self()?.storage.length) {
            text = "先取能量为建造做准备，或归档一张卡，触发初始装置抽取能量。";
        }
        if (view.final_round?.active && !view.game_over) text += " 最后一轮进行中。";
        byId("Prompt").innerHTML = `<strong>${esc(title)}</strong><p>${esc(text)}</p>`;
        panel.dataset.phase = phase;
        panel.classList.toggle("gizmos-waiting", !isTurn());
        byId("Steps").innerHTML = ["选择行动", "结算连锁", "下一位"].map((label, i) => `<span class="${step === i ? "is-current" : ""}" ${step === i ? 'aria-current="step"' : ""}><b>${i + 1}</b>${label}</span>`).join("");
        const summaries = { pick: "拿 1 颗公共能量", file: "保留 1 张市场卡", build: "支付能量启动装置", research: "看牌，最多保留 1 张" };
        byId("Actions").innerHTML = Object.keys(actionNames).map(action => {
            const available = actionAvailable(action);
            const reason = available ? summaries[action] : unavailableReason(action);
            return control(`<strong>${actionNames[action]}</strong><small>${esc(reason)}</small>`, "mode", {
                disabled: !available, className: `gizmos-action-choice ${mode === action && phase === "action" ? "is-selected" : ""}`,
                key: `mode:${action}`, extra: `data-mode="${action}" aria-pressed="${mode === action && phase === "action"}"`,
                tip: `${actionTips[action]} ${available ? "" : reason}`,
            });
        }).join("");
    }

    function renderEnergy() {
        const allowed = view.prompt?.bonus_context?.allowed_colors || colors;
        byId("BagCount").textContent = `Bag · ${view.energy_bag_count}`;
        byId("EnergyRow").innerHTML = colors.map(color => {
            const count = view.energy_row.filter(item => item === color).length;
            const enabled = can("pick_energy") && count > 0 && (view.phase !== "bonus_action" || allowed.includes(color));
            const [icon, name] = energy[color];
            return control(`<span class="gizmos-marble color-${color}">${icon}</span><span class="gizmos-energy-name">${name}</span><span class="gizmos-energy-count">×${count}</span>`, "energy", {
                disabled: !enabled, className: `gizmos-energy-option ${pickedColor === color ? "is-selected" : ""}`, key: `energy:${color}`,
                extra: `data-color="${color}" aria-pressed="${pickedColor === color}"`,
                tip: `${energyName(color)}：公共区有 ${count} 颗。${enabled ? "点选后确认拿取 1 颗。" : count === 0 ? "当前没有此颜色。" : !allowed.includes(color) ? "这个额外行动不允许选此颜色。" : unavailableReason("pick")}`,
            });
        }).join("");
        byId("PickPreview").hidden = !pickedColor;
        byId("PickPreview").innerHTML = pickedColor ? `<div><strong>${esc(energyName(pickedColor))} → Your energy</strong>${relatedHTML("pick", pickedColor)}</div>${control("Pick · 确认取 1 颗", "confirm-pick", { disabled: !can("pick_energy"), className: "primary", tip: `确认拿取 1 颗 ${energyName(pickedColor)}。然后结算匹配的取能量装置。` })}` : "";
    }

    function cardHTML(card, source) {
        const selected = selection?.id === card.id && selection?.source === source;
        const buildable = cardCanBuild(card, source);
        const fileable = cardCanFile(source);
        const free = view.prompt?.bonus_context?.kind === "build_free_level1";
        let state = buildable ? (free ? "免费建造" : "可建造") : !isTurn() ? "查看装置" : fileable ? "可先归档" : "暂不可建造";
        const costTip = `Cost（费用）：印刷费用 ${card.cost} ${energyName(card.energy_type)}。实际费用会计算升级折扣和可用转换器，以「可建造」标记为准。`;
        let choices = "";
        if (selected) {
            const reason = pending ? "等待行动确认" : !isTurn() ? "等待你的回合" : free && card.level !== 1 ? "此效果只能免费建造一级装置" : !card.buildable ? "当前能量 / 转换器不足" : "先完成当前效果";
            const buildTip = !buildable ? reason : free ? "Free Build（🛠️ 免费建造）：无需支付能量，启动这个一级装置，然后结算匹配的建造效果。" : "Build（🛠️ 建造）：支付能量并启动装置；升级折扣和转换器会自动结算。";
            choices = `<div class="gizmos-tile-decision"><div class="gizmos-decision-buttons">${control(free ? "Free Build · 免费建造" : "Build · 建造", "build", { disabled: !buildable, className: mode === "file" ? "" : "primary", key: `build:${source}:${card.id}`, extra: `data-card="${esc(card.id)}" data-source="${source}"`, tip: buildTip })}
                ${source !== "archive" ? control("File · 归档", "file", { disabled: !fileable, className: mode === "file" ? "primary" : "", key: `file:${source}:${card.id}`, extra: `data-card="${esc(card.id)}" data-source="${source}"`, tip: fileable ? actionTips.file : !isTurn() ? "等待你的回合" : fileReason() }) : ""}</div>
                ${!buildable ? `<p class="gizmos-decision-note">${esc(reason)}</p>` : ""}
                ${source !== "archive" && !fileable && isTurn() ? `<p class="gizmos-decision-note">File：${esc(fileReason())}</p>` : ""}
                ${relatedHTML(mode === "file" && fileable ? "file" : "build", null, card, source)}</div>`;
        }
        const order = source === "research" ? `<div class="gizmos-order-controls"><small>Return #${researchOrder.indexOf(card.id) + 1}</small>${control("Earlier", "order", { disabled: pending || researchOrder[0] === card.id, key: `earlier:${card.id}`, extra: `data-card="${esc(card.id)}" data-delta="-1"`, tip: "Earlier：向前调整放回顺序。第 1 张放在牌库最底部。" })}${control("Later", "order", { disabled: pending || researchOrder.at(-1) === card.id, key: `later:${card.id}`, extra: `data-card="${esc(card.id)}" data-delta="1"`, tip: "Later：向后调整放回顺序。在放回的卡中，越靠后的卡越靠近牌库顶部。" })}</div>` : "";
        return `<article class="gizmos-tile level-${card.level} ${selected ? "is-selected" : ""} ${buildable ? "is-buildable" : ""}">
            <div class="gizmos-tile-meta">${info(`${energy[card.energy_type]?.[0] || "🌈"} <strong>${card.cost}</strong>`, costTip)}${info(`⭐ <strong>${card.vp}</strong>`, `Points（⭐ 分数）：建造此装置获得 ${card.vp} 点卡牌分数。`)}${info("ⓘ", cardDescription(card), "gizmos-card-info")}</div>
            <button type="button" class="gizmos-tile-select" data-ui="card" data-card="${esc(card.id)}" data-source="${source}" data-focus="card:${source}:${esc(card.id)}" data-gizmos-explain="${esc(cardDescription(card))}" aria-expanded="${selected}" aria-label="${esc(`Level ${card.level} · ${triggerText(card)}：${effectText(card.effect, card.text)} · ${state}`)}">
                <span class="gizmos-tile-category">${panels[card.panel] || esc(card.panel)} <small>LEVEL ${card.level}</small></span>
                <span class="gizmos-trigger">${esc(triggerText(card))}</span><strong class="gizmos-benefit">${esc(effectText(card.effect, card.text))}</strong>
                <span class="gizmos-tile-state">${buildable ? "✓ " : ""}${state}<span>${selected ? "−" : "+"}</span></span>
            </button>${choices}${order}</article>`;
    }

    function renderMarket() {
        const archive = self()?.archive || [];
        byId("MarketNav").innerHTML = `<div class="gizmos-source-tabs" role="group" aria-label="Card source">${["display", "archive"].map(source => control(source === "display" ? "Market" : `Archive · ${archive.length}`, "source", {
            className: marketSource === source ? "is-selected" : "", key: `source:${source}`, extra: `data-source="${source}" aria-pressed="${marketSource === source}"`, tip: source === "display" ? "Market：所有玩家共享的公开装置卡。" : "Archive（🗂️ 档案）：你保留的卡，仍需支付费用建造才会生效。",
        })).join("")}</div><div class="gizmos-level-tabs" role="group" aria-label="Market level" ${marketSource === "archive" ? "hidden" : ""}>${[1, 2, 3].map(n => control(`Level ${n}`, "level", {
            className: level === n ? "is-selected" : "", key: `level:${n}`, extra: `data-level="${n}" aria-pressed="${level === n}"`, tip: `Level ${n}（${n} 级装置）：点击查看该等级的公开市场。`,
        })).join("")}</div>`;
        const cards = marketSource === "archive" ? archive : (view.display[String(level)] || []).filter(Boolean);
        const available = cards.filter(card => cardCanBuild(card, marketSource)).length;
        byId("MarketHint").textContent = marketSource === "archive" ? `你的档案 · ${archive.length}/${self()?.file_limit || 0} 张${available ? ` · ${available} 张可建造` : ""}` : `Level ${level} · ${cards.length} 张${available ? ` · ${available} 张可建造` : ""} · 点卡牌查看行动`;
        byId("Display").innerHTML = cards.map(card => cardHTML(card, marketSource)).join("") || `<p class="gizmos-empty-state">${marketSource === "archive" ? "档案为空。使用 File 可以先保留一张市场卡。" : "这一等级的市场已空，可切换其他等级。"}</p>`;
    }

    function effectLabel(effect) {
        const match = activeCards(self()).find(card => `${card.panel_icon} ${card.text}` === effect.label);
        return match ? `${triggerText(match)} → ${effectText(match.effect, match.text)}` : effect.label;
    }

    function effectReason(effect) {
        const you = self();
        if (["draw_random", "pick_energy"].includes(effect.kind)) return you.storage.length >= you.storage_limit ? "储能已满，暂时不能获得能量" : "当前没有符合条件的能量";
        if (effect.kind === "perform_file") return fileReason();
        if (effect.kind === "perform_research") return you.can_research ? "研究牌库已空" : "研究已被装置禁用";
        if (effect.kind === "free_build_level1") return "当前没有可用的一级装置";
        return "当前不满足效果条件，可先结算其他效果";
    }

    function renderContext() {
        const target = byId("Context");
        const prompt = view.prompt || {};
        let html = "";
        if (isTurn() && view.phase === "choose_effect") {
            html = `<h3>Resolve chain <span>连锁结算</span></h3><div class="gizmos-effect-list">${(prompt.pending_effects || []).map((effect, index) => `<div class="gizmos-effect-row"><span class="gizmos-effect-number">${index + 1}</span><div><strong>${esc(effectLabel(effect))}</strong><small>${effect.resolvable ? "现在可结算" : esc(effectReason(effect))}</small></div>${control("Resolve", "effect", { disabled: pending || !effect.resolvable, className: "primary", key: `effect:${effect.effect_id}`, extra: `data-effect="${effect.effect_id}"`, tip: `Resolve（⚡ 结算）：${effectLabel(effect)}。${effect.resolvable ? "点击执行这个效果，再按提示继续。" : effectReason(effect)}` })}</div>`).join("")}</div>
                ${control("End chain · 跳过剩余效果", "end-chain", { disabled: !can("pass_effects"), className: "subtle", tip: "End chain：放弃本回合还没有结算的可选效果，然后继续游戏。" })}`;
        } else if (isTurn() && view.phase === "research" && prompt.research) {
            const cards = prompt.research.cards || [];
            researchOrder = researchOrder.filter(id => cards.some(card => card.id === id));
            cards.forEach(card => { if (!researchOrder.includes(card.id)) researchOrder.push(card.id); });
            html = `<h3>Research · Level ${prompt.research.level}</h3><p class="gizmos-context-note">选择一张卡；其余按下方顺序放回。Return #1 最深。</p><div class="gizmos-research-grid">${researchOrder.map(id => cardHTML(cards.find(card => card.id === id), "research")).join("")}</div>${control("Return all · 全部放回", "return-all", { disabled: !can("resolve_research"), className: "subtle", tip: "Return all：不保留研究卡，全部按当前顺序放回牌库底部。" })}`;
        } else if (can("research") && (mode === "research" || prompt.bonus_context?.kind === "research")) {
            html = `<h3>Research <span>选择牌库等级</span></h3><p class="gizmos-context-note">查看至多 ${self().research_amount} 张卡，再决定建造、归档或全部放回。</p><div class="gizmos-research-levels">${[1, 2, 3].map(n => control(`Research · Level ${n}`, "research", { extra: `data-level="${n}"`, key: `research:${n}`, tip: `${actionTips.research} 此按钮查看 ${n} 级牌库。` })).join("")}</div>`;
        } else if (can("pass_turn")) {
            html = `<p>当前没有可执行的基础行动。</p>${control("Pass turn", "pass", { tip: "没有能执行的取能量、归档、建造或研究时，跳过本回合。" })}`;
        }
        target.hidden = !html;
        target.innerHTML = html;
    }

    function machineHTML(player) {
        return Object.entries(player.active || {}).filter(([, cards]) => cards.length).map(([group, cards]) => `<div class="gizmos-machine-group"><h4>${panels[group]} <span>${cards.length}</span></h4>${cards.map(card => `<button type="button" class="gizmos-machine-item" data-ui="tip" ${attributes(cardDescription(card))}><span>${esc(triggerText(card))}</span><strong>${esc(effectText(card.effect, card.text))}</strong></button>`).join("")}</div>`).join("");
    }

    function renderLab() {
        const you = self();
        if (!you) return;
        byId("MachineCount").textContent = `${activeCards(you).length} gizmos`;
        byId("You").innerHTML = machineHTML(you);
        byId("Players").innerHTML = view.players.map(player => {
            const count = activeCards(player).length;
            return `<details class="gizmos-player-summary ${player.player_id === view.current_turn ? "is-current" : ""}" data-player="${esc(player.player_id)}" ${openPlayers.has(player.player_id) ? "open" : ""}><summary><span>${esc(player.name)}${player.is_bot ? " · AI" : player.player_id === view.you ? " · You" : ""}</span><strong>${player.projected_score} <small>points</small></strong></summary>
                <div class="gizmos-player-detail"><div class="gizmos-player-energy">${resourceHTML(player, true)}</div>
                <div class="gizmos-progress-pills">${info(`⚙️ ${count} / 16`, "Gizmos（⚙️ 装置）：包括初始装置。任一玩家达到 16 个装置，触发最后一轮。")}${info(`Ⅲ ${player.level3_count} / 4`, "Level 3（Ⅲ 三级装置）：任一玩家达到 4 个，触发最后一轮。")}${info(`🏁 ${player.projected_score}`, "Projected（🏁 预估总分）：当前分数加上此刻可见的终局奖励。")}</div>
                <p class="gizmos-caption">Archive · ${player.archive.length}/${player.file_limit}</p>${player.archive.map(card => `<p class="gizmos-opponent-archive">${esc(cardDescription(card))}</p>`).join("") || '<p class="gizmos-caption">No archived cards</p>'}${player.player_id !== view.you ? machineHTML(player) : ""}</div></details>`;
        }).join("");
        byId("ActivityCount").textContent = String(history.length);
        byId("Activity").innerHTML = history.length ? history.map(text => `<li>${esc(text)}</li>`).join("") : "<li>行动记录会显示在这里。</li>";
        byId("Recent").hidden = !lastBotAction;
        byId("Recent").textContent = lastBotAction ? `🤖 最近 AI 行动 · ${lastBotAction}` : "";
    }

    function updateExplain() {
        panel.classList.toggle("gizmos-is-explaining", explaining);
        panel.querySelectorAll("[data-gizmos-explain]").forEach(node => node.classList.toggle("has-explanation", explaining));
        byId("ExplainBtn")?.classList.toggle("active", explaining);
        byId("ExplainBtn")?.setAttribute("aria-pressed", String(explaining));
    }

    function render() {
        if (!view) return;
        const focus = panel.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
        hideTip();
        renderHeader();
        renderGuide();
        renderEnergy();
        renderContext();
        renderMarket();
        renderLab();
        byId("Actions").hidden = !isTurn() || view.phase !== "action";
        const researching = isTurn() && view.phase === "research";
        panel.querySelector(".gizmos-energy-section").hidden = researching;
        panel.querySelector(".gizmos-market-section").hidden = researching;
        updateExplain();
        if (focus) Array.from(panel.querySelectorAll("[data-focus]")).find(node => node.dataset.focus === focus)?.focus({ preventScroll: true });
    }

    function submit(action) {
        if (pending || !can(action.type)) return;
        hideTip();
        pending = true;
        selection = null;
        pickedColor = null;
        render();
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => {
            pending = false;
            render();
        }, 7000);
        sendAction(action);
    }

    function resolveResearch(choice, cardId) {
        const payload = { type: "resolve_research", choice, return_order: researchOrder.filter(id => choice === "none" || id !== cardId) };
        if (choice !== "none") payload.card_id = cardId;
        submit(payload);
    }

    function recordEvents(data) {
        for (const event of data.events || []) {
            if (!event.type.startsWith("gizmos:")) continue;
            const actor = view.players.find(player => player.player_id === event.player_id);
            const card = cardCatalog.get(event.card_id);
            const cardName = card ? effectText(card.effect, card.text) : "装置";
            const labels = {
                pick_energy: `取了 ${energyName(event.color)}`, pick: `取了 ${energyName(event.color)}`,
                file_display: `归档：${cardName}`, build_display: `建造：${cardName}`, build_archive: `从档案建造：${cardName}`,
                research: `研究 Level ${event.level}`, research_build: `研究后建造：${cardName}`, research_file: `研究后归档：${cardName}`, research_none: "放回全部研究卡",
                resolve_effect: `结算：${cardName}`, pass_effects: "结束了连锁", bonus_pick: `额外取了 ${energyName(event.color)}`,
                bonus_file: `额外归档：${cardName}`, bonus_research: `额外研究 Level ${event.level}`, bonus_build_display: `免费建造：${cardName}`,
                bonus_build_archive: `从档案免费建造：${cardName}`, pass_turn: "跳过回合",
            };
            const label = labels[event.type.slice(7)];
            if (!label) continue;
            const text = `${actor?.name || "Player"} · ${label}`;
            history.unshift(text);
            if (actor?.is_bot) lastBotAction = text;
        }
        history = history.slice(0, 24);
    }

    function reset() {
        hideTip();
        clearTimeout(pendingTimer);
        clearTimeout(suppressTimer);
        view = null;
        roomKey = null;
        version = null;
        mode = "pick";
        marketSource = "display";
        level = 1;
        selection = null;
        pickedColor = null;
        researchOrder = [];
        pending = false;
        suppressClick = false;
        history = [];
        lastBotAction = "";
        cardCatalog = new Map();
        openPlayers.clear();
        explaining = false;
        updateExplain();
        ["Standing", "Resources", "Actions", "Steps", "Display", "You", "Players", "MarketNav", "MarketHint", "EnergyRow", "Activity"].forEach(id => { byId(id).innerHTML = ""; });
        ["Recent", "Context", "PickPreview"].forEach(id => { byId(id).hidden = true; });
        byId("Prompt").textContent = "Waiting for game…";
        ["HelpModal", "ExplainModal"].forEach(id => setModalVisible(byId(id), false));
    }

    window.clearGizmosState = reset;
    window.showGizmosHeaderActions = show => {
        byId("HeaderActions").style.display = show ? "flex" : "none";
        if (!show) {
            hideTip();
            explaining = false;
            updateExplain();
            ["HelpModal", "ExplainModal"].forEach(id => setModalVisible(byId(id), false));
        }
    };
    window.renderGizmosGameState = data => {
        if (!data?.view) return;
        if (roomKey !== data.room_id || (typeof data.state_version === "number" && typeof version === "number" && data.state_version < version)) reset();
        const previous = view;
        const changed = data.state_version == null || version !== data.state_version;
        view = data.view;
        roomKey = data.room_id;
        if (changed) {
            pending = false;
            clearTimeout(pendingTimer);
            if (!previous || previous.current_turn !== view.current_turn || previous.phase !== view.phase) {
                selection = null;
                pickedColor = null;
                mode = "pick";
            }
            if (previous?.phase === "research" && view.phase !== "research") researchOrder = [];
            if (isTurn() && view.phase === "bonus_action") {
                const kind = view.prompt.bonus_context?.kind;
                mode = kind === "build_free_level1" ? "build" : kind;
                if (kind === "build_free_level1") level = 1;
                if (kind === "file") marketSource = "display";
            }
        }
        if (currentGameType !== "gizmos") {
            currentGameType = "gizmos";
            setGamePanelVisibility("gizmos");
        }
        for (const card of [...allCards(), ...view.players.flatMap(activeCards)]) cardCatalog.set(card.id, card);
        if (changed) recordEvents(data);
        if (selection && !allCards().some(card => card.id === selection.id)) selection = null;
        if (pickedColor && (!view.energy_row.includes(pickedColor) || !can("pick_energy"))) pickedColor = null;
        version = data.state_version;
        render();
        logGameEvents(data);
    };

    const tooltip = document.createElement("div");
    tooltip.id = "gizmosTooltip";
    tooltip.className = "gizmos-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.appendChild(tooltip);

    function hideTip() {
        clearTimeout(tooltipTimer);
        if (tooltipTarget) tooltipTarget.removeAttribute("aria-describedby");
        tooltipTarget = null;
        tooltip.hidden = true;
    }

    function showTip(target, timed = false) {
        if (!target?.dataset.gizmosTip || explaining || !panel.contains(target)) return;
        hideTip();
        tooltipTarget = target;
        tooltip.textContent = target.dataset.gizmosTip;
        tooltip.hidden = false;
        target.setAttribute("aria-describedby", tooltip.id);
        const viewport = window.visualViewport;
        const width = viewport?.width || document.documentElement.clientWidth;
        const height = viewport?.height || innerHeight;
        const leftEdge = viewport?.offsetLeft || 0;
        const topEdge = viewport?.offsetTop || 0;
        tooltip.style.maxWidth = `${Math.max(120, Math.min(330, width - 24))}px`;
        tooltip.style.maxHeight = `${Math.max(80, height - 24)}px`;
        const rect = target.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        const left = Math.max(leftEdge + 12, Math.min(rect.left, leftEdge + width - box.width - 12));
        const top = rect.bottom + box.height + 8 < topEdge + height - 12 ? rect.bottom + 8 : Math.max(topEdge + 12, rect.top - box.height - 8);
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        if (timed) tooltipTimer = setTimeout(hideTip, 3000);
    }

    function closeDialog(modal) {
        if (modal.classList.contains("hidden")) return;
        setModalVisible(modal, false);
        const target = returnFocus?.isConnected ? returnFocus : byId("HelpBtn");
        target?.focus({ preventScroll: true });
    }

    function openDialog(kind, text = "") {
        hideTip();
        returnFocus = document.activeElement;
        explaining = false;
        updateExplain();
        byId(`${kind}Content`).innerHTML = kind === "Help" ? helpHTML : `<p>${esc(text)}</p>`;
        setModalVisible(byId(`${kind}Modal`), true);
        byId(`${kind}ModalCloseBtn`).focus();
    }

    function explainTarget(event) {
        const direct = event.target.closest?.("button, summary, [data-gizmos-explain]");
        if (direct?.dataset.gizmosExplain && panel.contains(direct)) return direct;
        if (event.type !== "pointerdown") return null;
        // Native disabled buttons may not be the event target. Inspect only
        // visible explained controls at this pointer position.
        return Array.from(panel.querySelectorAll("[data-gizmos-explain]")).reverse().find(node => {
            if (!node.getClientRects().length) return false;
            const rect = node.getBoundingClientRect();
            return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
    }

    function inspectClick(event) {
        if (currentGameType !== "gizmos") return;
        if (event.type === "click" && suppressClick) {
            event.preventDefault();
            event.stopImmediatePropagation();
            suppressClick = false;
            clearTimeout(suppressTimer);
            return;
        }
        const ignored = [byId("HelpBtn"), byId("ExplainBtn"), byId("HelpModalCloseBtn"), byId("ExplainModalCloseBtn")];
        const button = event.target.closest?.("button");
        if (ignored.includes(button)) return;
        if (!explaining) return;
        const target = explainTarget(event);
        // Explain mode blocks every ordinary action, including controls outside
        // this game and controls which have no explanation.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (target) {
            suppressClick = event.type === "pointerdown";
            clearTimeout(suppressTimer);
            suppressTimer = setTimeout(() => { suppressClick = false; }, 600);
            openDialog("Explain", target.dataset.gizmosExplain);
        }
    }
    document.addEventListener("pointerdown", inspectClick, true);
    document.addEventListener("click", inspectClick, true);

    panel.addEventListener("click", event => {
        const button = event.target.closest("[data-ui]");
        if (!button || button.disabled || explaining) return;
        const action = button.dataset.ui;
        if (action === "tip") { showTip(button, true); return; }
        if (pending && !["source", "level", "card"].includes(action)) return;
        hideTip();
        const id = button.dataset.card;
        const source = button.dataset.source;
        if (action === "mode") {
            mode = button.dataset.mode;
            selection = null;
            pickedColor = null;
            if (mode === "file") marketSource = "display";
            if (mode === "build" && !Object.values(view.display).flat().some(card => card?.buildable) && self().archive.some(card => card.buildable)) marketSource = "archive";
        } else if (action === "source") { marketSource = source; selection = null; }
        else if (action === "level") { level = Number(button.dataset.level); selection = null; }
        else if (action === "energy") { pickedColor = pickedColor === button.dataset.color ? null : button.dataset.color; selection = null; mode = "pick"; }
        else if (action === "card") {
            selection = selection?.id === id && selection?.source === source ? null : { id, source };
            pickedColor = null;
        } else if (action === "confirm-pick") { if (pickedColor) submit({ type: "pick_energy", color: pickedColor }); return; }
        else if (action === "build" || action === "file") {
            const card = allCards().find(item => item.id === id);
            if (!card || !(action === "build" ? cardCanBuild(card, source) : cardCanFile(source))) return;
            if (source === "research") resolveResearch(action, id);
            else submit({ type: action === "file" ? "file_display" : `build_${source}`, card_id: id });
            return;
        } else if (action === "research") { submit({ type: "research", level: Number(button.dataset.level) }); return; }
        else if (action === "return-all") { resolveResearch("none"); return; }
        else if (action === "effect") { submit({ type: "resolve_effect", effect_id: Number(button.dataset.effect) }); return; }
        else if (action === "end-chain") { submit({ type: "pass_effects" }); return; }
        else if (action === "pass") { submit({ type: "pass_turn" }); return; }
        else if (action === "order") {
            const i = researchOrder.indexOf(id);
            const next = i + Number(button.dataset.delta);
            if (i >= 0 && next >= 0 && next < researchOrder.length) [researchOrder[i], researchOrder[next]] = [researchOrder[next], researchOrder[i]];
        }
        const focusKey = button.dataset.focus;
        render();
        if (event.pointerType === "touch" && ["energy", "mode", "level", "source"].includes(action)) {
            const next = Array.from(panel.querySelectorAll("[data-focus]")).find(node => node.dataset.focus === focusKey);
            showTip(next, true);
        }
    });

    panel.addEventListener("toggle", event => {
        const id = event.target.dataset.player;
        if (!id || !event.target.isConnected) return;
        if (event.target.open) openPlayers.add(id);
        else openPlayers.delete(id);
    }, true);
    panel.addEventListener("pointerover", event => {
        if (event.pointerType !== "mouse") return;
        const target = event.target.closest("[data-gizmos-tip]");
        if (target && target !== tooltipTarget) showTip(target);
    });
    panel.addEventListener("pointerout", event => {
        if (event.pointerType === "mouse" && tooltipTarget && !tooltipTarget.contains(event.relatedTarget)) hideTip();
    });
    panel.addEventListener("focusin", event => {
        if (event.target.matches("[data-gizmos-tip]") && event.target.matches(":focus-visible")) showTip(event.target);
    });
    panel.addEventListener("focusout", hideTip);
    document.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", hideTip);
    document.addEventListener("click", event => {
        if (!view || currentGameType !== "gizmos" || explaining || suppressClick) return;
        if (event.target.closest("button, input, select, textarea, summary, a, .modal, .gizmos-tile, .gizmos-context")) return;
        hideTip();
        if (selection || pickedColor) { selection = null; pickedColor = null; render(); }
    });
    byId("HelpBtn").addEventListener("click", () => openDialog("Help"));
    byId("ExplainBtn").addEventListener("click", () => { hideTip(); explaining = !explaining; updateExplain(); });
    ["Help", "Explain"].forEach(kind => {
        const modal = byId(`${kind}Modal`);
        byId(`${kind}ModalCloseBtn`).addEventListener("click", () => closeDialog(modal));
        modal.addEventListener("click", event => { if (event.target === modal) closeDialog(modal); });
    });
    document.addEventListener("keydown", event => {
        if (currentGameType !== "gizmos") return;
        const modal = [byId("HelpModal"), byId("ExplainModal")].find(node => !node.classList.contains("hidden"));
        if (modal && event.key === "Tab") {
            const focusables = Array.from(modal.querySelectorAll("button:not(:disabled), a[href], [tabindex='0']")).filter(node => node.getClientRects().length);
            const first = focusables[0];
            const last = focusables.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if (event.key !== "Escape") return;
        hideTip();
        if (modal) { event.preventDefault(); closeDialog(modal); return; }
        if (explaining) { explaining = false; updateExplain(); return; }
        if (selection || pickedColor) { selection = null; pickedColor = null; render(); }
    });
    byId("MachineDetails").open = window.matchMedia("(min-width: 900px)").matches;
})();
