(() => {
    "use strict";

    const panel = document.getElementById("cheatyMagesPanel");
    const header = document.getElementById("cheatyMagesHeaderActions");
    const helpButton = document.getElementById("cheatyMagesHelpBtn");
    const explainButton = document.getElementById("cheatyMagesExplainBtn");
    if (!panel || !header || !helpButton || !explainButton) return;

    let view = null, signature = null, selectedCard = null, mode = "cast";
    let selectedBets = [], selectedDiscards = [], choices = {};
    let pending = false, pendingTimer = null, explaining = false, suppressUntil = 0;
    let tipTimer = null, returnFocus = null, historyOpen = false;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
    const same = (left, right) => String(left) === String(right);
    const signed = number => Number(number) > 0 ? `+${number}` : String(number ?? 0);
    const playerName = id => (view?.players || []).find(player => player.player_id === id)?.name || "—";
    const fighterName = slot => {
        const fighter = (view?.fighters || []).find(item => same(item.slot, slot));
        return fighter ? `${fighter.slot} · ${fighter.icon || "👹"} ${fighter.name_zh || fighter.name}` : String(slot);
    };
    const kindNames = {direct: "直接(☀️)", enchantment: "赋予(🌙)", enchant: "赋予(🌙)", support: "支援(✨)"};
    const kindIcons = {direct: "☀️", enchantment: "🌙", enchant: "🌙", support: "✨"};
    const descriptions = {
        coins: "金币(💰)：每人以 2 枚开始，押注不支付押金。三轮有效比赛后金币最多者获胜；同币比较剩余手牌数，再同则并列。",
        power: "强度(⚔️)：印刷强度加有效法术修正；裁判先判罚，再比较强度。相同时比较斗士印刷强度。暗牌尚未全部揭示时，显示的是你已知的部分。",
        mana: "魔力(🔮)：斗士身上法术的总魔力。只有超过裁判上限才受罚，等于上限安全。暗牌尚未全部揭示时，显示的是你已知的部分。",
        prize: "赏金(💰)：押中胜者时，押一名获双倍赏金，押两名获原赏金，押三名获一半赏金（向上取整）。法术可以改变赏金。",
        bet: "押注(🎲)：秘密选择 1–3 名不同斗士，点击斗士可选择或取消，再点 Confirm Bet。押注不扣金币(💰)，提交后本轮不可重选（除非法术效果允许）。",
        cast: "施法(🪄)：点选一张手牌，再选择法术需要的斗士(👹)、法术或玩家目标，最后点 Cast。直接(☀️)公开；赋予(🌙)暗置；支援(✨)依牌面生效。灰色牌当前无法合法施放。",
        peek: "窥探(👁️)：选择一张手牌作为代价弃掉，再选择斗士(👹)，秘密查看它身上所有暗置法术。本次窥探占用一次行动；牌的效果不会发动。",
        pass: "放弃(✋)：永久退出本轮行动，之后不能再施法或窥探。本轮押注仍有效。所有玩家放弃或用完手牌后结算。",
        discard: "弃牌(🗑️)：遗忘法术要求目标弃掉 1 张。轮间可以先弃任意数量（也可零张），之后最多抽牌：3–4 人抽 4 张，5–6 人抽 3 张，到手牌上限即停止。",
        hand: "手牌(🂠)只有自己可见。直接(☀️)、赋予(🌙)、支援(✨)表示施放方式；禁咒(🚫)受裁判限制。点击牌选择操作；牌面详情可用 Explain，或悬停／点击非操作图标查看。",
        hidden: "暗置法术(🌙)：仅施放者和已窥探过这张牌的玩家可见牌面。未知暗牌只显示背面，不计入你已知的精确强度(⚔️)和魔力(🔮)。轮末全部公开。",
        judge: "裁判(⚖️)：每轮决定魔力(🔮)上限、超限处罚、禁咒(🚫)与额外规则。查看本轮裁判名称可了解具体效果。先处理裁判，再比较斗士强度(⚔️)。",
        player: "玩家席位显示金币(💰)、手牌(🂠)数量、已押注和已放弃状态。押注目标及其他玩家手牌在结算前保密。当前行动者以 Playing 标记。",
        next: "Next Round：确认你已看完本轮结算。所有玩家都确认后才继续；最后一轮也须全员确认，再显示最终胜利者。机器人只确认自己的席位。",
        result: "结算(🏆)：揭开所有暗牌，处理裁判(⚖️)处罚，再比强度(⚔️)并计算押注收益。所有斗士退场时取消比赛、不发赏金，并追加一轮。最后按金币(💰)，再按剩余手牌数判定胜者。",
        deck: "牌库(🂠)：共 72 张、36 种法术。起手 3–4／5／6 人分别 8／6／5 张。轮间保留未弃手牌，按人数抽 4／3 张，最多抽到手牌上限。",
        log: "公开记录(📜)只记公开行动与结果，不泄露秘密押注、暗牌身份或窥探内容。此区域可独立滚动。",
        discardPile: "弃牌堆(🗑️)：公开显示已弃置的法术。查看牌面可了解效果，其他玩家尚在手中的牌始终保密。",
        target: "目标斗士(👹)：这里只列出当前所选法术或窥探行动可用的目标。也可以直接点击竞技场中的目标。",
        spell_id: "目标法术(🪄)：选择场上符合这张牌效果的法术。暗牌只显示你有权知道的信息；裁判和玩家身上的持续法术也可能被指定。",
        player_id: "目标玩家：选择这张法术允许指定的玩家。只能选择仍有可弃手牌的合法目标。",
        from_slot: "原押注(🎲)：选择要移走的那一注。只有你的当前押注里合法的号码会出现。",
        to_slot: "新押注(🎲)：选择该注转去的斗士。其他押注保持原位，不允许重复押同一名。",
        face_down: "施放方式：棱镜光线(🌈)允许将直接法术(☀️)暗置。Face Up 公开牌面；Face Down 只让自己和以后窥探者看到，不改变法术类别或魔力。",
        bribe: "贿赂(💰)：最终轮中，可为每张被裁判禁止的法术支付 2 金币，以绕过该次类别禁令。若该牌需要费用，Cast 按钮会明确标注。",
        effects: "持续支援(✨)：显示影响玩家或裁判的公开法术。它们可能被驱散等法术指定；点 Explain 后选择该牌可查看效果。",
    };
    const tipAttrs = text => `tabindex="0" data-cm-tip="${esc(text)}" data-cm-explain="${esc(text)}"`;
    const info = (html, text) => `<span ${tipAttrs(text)}>${html}</span>`;
    const explainAttr = key => `data-cm-explain="${esc(descriptions[key] || key)}"`;
    const moves = type => (view?.legal_moves || []).filter(move => !type || move.type === type);
    const available = type => !pending && moves(type).length > 0;
    const ownPlayer = () => (view?.players || []).find(player => player.player_id === view.you);
    const cardLabel = card => `${card?.icon || "🪄"} ${card?.name_zh || card?.name || "未知法术"}`;
    const cardDescription = card => `${cardLabel(card)}${card?.name ? ` / ${card.name}` : ""} · ${kindNames[card?.kind] || "法术"}${card?.forbidden ? " · 禁咒(🚫)" : ""} · 魔力(🔮) ${card?.mana ?? 0}${card?.power ? ` · 强度(⚔️) ${signed(card.power)}` : ""}。${card?.description || ""}`;

    // Original summaries mirrored from game/cheaty_mages_data.py for the full Help reference.
    const spellReference = [
        {"name": "Cure", "name_zh": "治愈", "icon": "💚", "kind": "direct", "mana": 0, "power": 2, "count": 4, "forbidden": false, "description": "斗士强度(⚔️) +2；魔力(🔮) +0。"},
        {"name": "Healing", "name_zh": "疗伤", "icon": "❤️‍🩹", "kind": "direct", "mana": 1, "power": 4, "count": 4, "forbidden": false, "description": "斗士强度(⚔️) +4；魔力(🔮) +1。"},
        {"name": "Regeneration", "name_zh": "再生", "icon": "🌱", "kind": "direct", "mana": 3, "power": 3, "count": 2, "forbidden": false, "description": "斗士强度(⚔️) +3；魔力(🔮) +3。"},
        {"name": "Energy Boost", "name_zh": "能量激增", "icon": "🌟", "kind": "direct", "mana": 4, "power": 6, "count": 1, "forbidden": false, "description": "斗士强度(⚔️) +6；魔力(🔮) +4。"},
        {"name": "Refresh", "name_zh": "焕然新生", "icon": "☀️", "kind": "direct", "mana": 6, "power": 10, "count": 1, "forbidden": true, "description": "斗士强度(⚔️) +10；魔力(🔮) +6。"},
        {"name": "Magic Missile", "name_zh": "魔法飞弹", "icon": "☄️", "kind": "direct", "mana": 0, "power": -2, "count": 4, "forbidden": false, "description": "斗士强度(⚔️) -2；魔力(🔮) +0。"},
        {"name": "Fireball", "name_zh": "火球", "icon": "🔥", "kind": "direct", "mana": 1, "power": -4, "count": 4, "forbidden": false, "description": "斗士强度(⚔️) -4；魔力(🔮) +1。"},
        {"name": "Lightning Bolt", "name_zh": "闪电", "icon": "⚡", "kind": "direct", "mana": 3, "power": -3, "count": 2, "forbidden": false, "description": "斗士强度(⚔️) -3；魔力(🔮) +3。"},
        {"name": "Blizzard", "name_zh": "暴风雪", "icon": "❄️", "kind": "direct", "mana": 4, "power": -6, "count": 1, "forbidden": false, "description": "斗士强度(⚔️) -6；魔力(🔮) +4。"},
        {"name": "Meteor Strike", "name_zh": "陨星冲击", "icon": "🌠", "kind": "direct", "mana": 6, "power": -10, "count": 1, "forbidden": true, "description": "斗士强度(⚔️) -10；魔力(🔮) +6。"},
        {"name": "Strengthen", "name_zh": "强化", "icon": "💪", "kind": "enchant", "mana": 2, "power": 3, "count": 4, "forbidden": false, "description": "斗士强度(⚔️) +3；魔力(🔮) +2。"},
        {"name": "Might", "name_zh": "神力", "icon": "🦾", "kind": "enchant", "mana": 4, "power": 5, "count": 4, "forbidden": false, "description": "斗士强度(⚔️) +5；魔力(🔮) +4。"},
        {"name": "Haste", "name_zh": "加速", "icon": "💨", "kind": "enchant", "mana": 6, "power": 4, "count": 2, "forbidden": false, "description": "斗士强度(⚔️) +4；魔力(🔮) +6。"},
        {"name": "Power Awakening", "name_zh": "力量觉醒", "icon": "🐅", "kind": "enchant", "mana": 8, "power": 8, "count": 1, "forbidden": false, "description": "斗士强度(⚔️) +8；魔力(🔮) +8。"},
        {"name": "Giant Growth", "name_zh": "巨化", "icon": "🗻", "kind": "enchant", "mana": 10, "power": 12, "count": 1, "forbidden": true, "description": "斗士强度(⚔️) +12；魔力(🔮) +10。"},
        {"name": "Weaken", "name_zh": "虚弱", "icon": "🥀", "kind": "enchant", "mana": 2, "power": -3, "count": 4, "forbidden": false, "description": "斗士强度(⚔️) -3；魔力(🔮) +2。"},
        {"name": "Cripple", "name_zh": "衰竭", "icon": "🪫", "kind": "enchant", "mana": 4, "power": -5, "count": 4, "forbidden": false, "description": "斗士强度(⚔️) -5；魔力(🔮) +4。"},
        {"name": "Slow", "name_zh": "迟缓", "icon": "🐌", "kind": "enchant", "mana": 6, "power": -4, "count": 2, "forbidden": false, "description": "斗士强度(⚔️) -4；魔力(🔮) +6。"},
        {"name": "Paralyze", "name_zh": "麻痹", "icon": "🕸️", "kind": "enchant", "mana": 8, "power": -8, "count": 1, "forbidden": false, "description": "斗士强度(⚔️) -8；魔力(🔮) +8。"},
        {"name": "Shrink", "name_zh": "缩小", "icon": "🐜", "kind": "enchant", "mana": 10, "power": -12, "count": 1, "forbidden": true, "description": "斗士强度(⚔️) -12；魔力(🔮) +10。"},
        {"name": "Mana Boost", "name_zh": "魔力增幅", "icon": "🔮", "kind": "enchant", "mana": 5, "power": 0, "count": 2, "forbidden": false, "description": "魔力(🔮) +5；不改变斗士强度(⚔️)。"},
        {"name": "Mana Seal", "name_zh": "魔力封印", "icon": "🔒", "kind": "enchant", "mana": -5, "power": 0, "count": 2, "forbidden": false, "description": "魔力(🔮) −5；不改变斗士强度(⚔️)。"},
        {"name": "Cause Unpopularity", "name_zh": "冷门赔率", "icon": "💰", "kind": "enchant", "mana": 3, "power": 0, "count": 2, "forbidden": false, "description": "目标斗士的赏金(💰)翻倍；两张各自生效。"},
        {"name": "Detect Magic", "name_zh": "侦测魔法", "icon": "👁️", "kind": "support", "mana": 0, "power": 0, "count": 2, "forbidden": false, "description": "秘密查看一名斗士当前的全部暗置法术(🌙)。"},
        {"name": "Dispel Magic", "name_zh": "驱散魔法", "icon": "🧹", "kind": "support", "mana": 0, "power": 0, "count": 2, "forbidden": false, "description": "弃置一张已在场上的法术；不能反制刚施放的即时法术。"},
        {"name": "Recall", "name_zh": "回忆", "icon": "📖", "kind": "support", "mana": 0, "power": 0, "count": 2, "forbidden": false, "description": "从法术牌库抽取一张手牌。"},
        {"name": "Amnesia", "name_zh": "遗忘", "icon": "🌀", "kind": "support", "mana": 0, "power": 0, "count": 2, "forbidden": false, "description": "指定一名玩家，由该玩家选择并弃置一张手牌。"},
        {"name": "Imitation", "name_zh": "偷换押注", "icon": "🎭", "kind": "support", "mana": 0, "power": 0, "count": 2, "forbidden": false, "description": "将自己的一张押注换成未押注号码；单注时不能使用。"},
        {"name": "Dimension Door", "name_zh": "次元之门", "icon": "🚪", "kind": "support", "mana": 0, "power": 0, "count": 1, "forbidden": false, "description": "弃置当前裁判(⚖️)及其附属法术，再抽取一位裁判。"},
        {"name": "Confusion", "name_zh": "迷惑", "icon": "💫", "kind": "support", "mana": 0, "power": 0, "count": 1, "forbidden": false, "description": "附于当前裁判(⚖️)，跳过其审判；更换裁判时失效，不解除禁用类别。"},
        {"name": "Invisibility", "name_zh": "隐身", "icon": "🫥", "kind": "support", "mana": 0, "power": 0, "count": 1, "forbidden": false, "description": "本轮自己可以施放被裁判禁用的法术；该牌被驱散后权限消失。"},
        {"name": "Prismatic Ray", "name_zh": "棱镜光线", "icon": "🌈", "kind": "support", "mana": 0, "power": 0, "count": 1, "forbidden": false, "description": "本轮自己可以将直接法术(☀️)暗置；不改变其类别与魔力。"},
        {"name": "Metamorphosis", "name_zh": "变形", "icon": "🦋", "kind": "support", "mana": 0, "power": 0, "count": 1, "forbidden": true, "description": "替换一名斗士，保留该号码的押注与附着法术；采用新斗士属性。"},
        {"name": "Alteration", "name_zh": "法术转移", "icon": "↪️", "kind": "support", "mana": 0, "power": 0, "count": 1, "forbidden": true, "description": "将一名斗士的一张法术移至另一名斗士；保留原来的明暗状态。"},
        {"name": "Anti-Magic Field", "name_zh": "反魔法领域", "icon": "🚫", "kind": "support", "mana": 0, "power": 0, "count": 1, "forbidden": true, "description": "弃置一名斗士的全部法术；可以穿透反射(🪞)的保护。"},
        {"name": "Reflection", "name_zh": "反射", "icon": "🪞", "kind": "enchant", "mana": 3, "power": 0, "count": 1, "forbidden": true, "description": "明置。保护斗士及其法术免受新法术影响；反射本身仍可被驱散或转移，反魔法领域例外。"},
    ];
    const judgeReference = [
        {"name_zh": "严厉的阿德斯", "icon": "⚖️", "description": "魔力(🔮)超过10的斗士退场；禁用支援(✨)与禁咒(🚫)。"},
        {"name_zh": "瞌睡的泰德", "icon": "😴", "description": "不限制法术，也不执行魔力(🔮)判罚。"},
        {"name_zh": "善变的芬莉露", "icon": "🎲", "description": "审判时翻一张法术：直接(☀️)为10／退场，赋予(🌙)为15／解除，支援(✨)为5／解除。"},
        {"name_zh": "爽朗的萨普", "icon": "😊", "description": "魔力(🔮)超过15时解除该斗士所有法术；禁用禁咒(🚫)。"},
        {"name_zh": "投机的劳提", "icon": "🧐", "description": "魔力(🔮)超过10时解除该斗士所有法术。"},
        {"name_zh": "冷静的欧蕾尔", "icon": "❄️", "description": "魔力(🔮)超过12的斗士退场；禁用直接法术(☀️)。"},
        {"name_zh": "自大的理斯特", "icon": "🎩", "description": "魔力(🔮)超过15的斗士退场；魔力小于或等于4的斗士解除全部法术。"},
        {"name_zh": "狡黠的摩丽雅", "icon": "🦊", "description": "魔力(🔮)超过12时解除该斗士所有法术；禁用支援(✨)。"},
    ];

    const dialog = document.createElement("dialog");
    dialog.className = "cm-dialog";
    dialog.id = "cheatyMagesDialog";
    dialog.setAttribute("aria-labelledby", "cheatyMagesDialogTitle");
    dialog.innerHTML = '<div class="cm-dialog-heading"><h2 id="cheatyMagesDialogTitle">Help</h2><button type="button">Close</button></div><div class="cm-dialog-body"></div>';
    document.body.append(dialog);
    const dialogClose = dialog.querySelector("button");
    const tooltip = document.createElement("div");
    tooltip.className = "cm-tooltip";
    tooltip.id = "cheatyMagesTooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.append(tooltip);

    function hideTip() { tooltip.hidden = true; clearTimeout(tipTimer); }
    function showTip(element, temporary = false) {
        if (explaining || !element?.dataset.cmTip) return;
        hideTip();
        tooltip.textContent = element.dataset.cmTip;
        tooltip.hidden = false;
        const rect = element.getBoundingClientRect(), size = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - size.width - 12))}px`;
        tooltip.style.top = `${Math.max(12, Math.min(rect.top > size.height + 16 ? rect.top - size.height - 8 : rect.bottom + 8, innerHeight - size.height - 12))}px`;
        if (temporary) tipTimer = setTimeout(hideTip, 3000);
    }
    function setExplain(value) {
        explaining = value;
        panel.classList.toggle("cm-explaining", value);
        explainButton.setAttribute("aria-pressed", String(value));
        hideTip();
    }
    function openDialog(title, html) {
        hideTip();
        returnFocus = document.activeElement;
        dialog.querySelector("h2").textContent = title;
        dialog.querySelector(".cm-dialog-body").innerHTML = html;
        if (!dialog.open) dialog.showModal();
        dialog.scrollTop = 0;
        dialogClose.focus();
    }
    function help() {
        setExplain(false);
        openDialog("Help · 诈赌巫师", `
            <h3>目标与准备</h3><p>扮演观众席中的巫师，用法术左右斗士(👹)的战果，让自己的秘密押注(🎲)获得赏金(💰)。基础版 3–6 人，36 种法术共 72 张、10 名斗士、8 位裁判。每人以 2 金币(💰)开始。3–4／5／6 人分别持 8／6／5 张手牌(🂠)。每轮随机选出五名斗士(👹)与一位裁判(⚖️)。</p>
            <h3>秘密押注</h3><p>${descriptions.bet} ${descriptions.prize} 每人完成押注后进入施法。</p>
            <h3>轮流行动</h3><div class="cm-help-grid"><div><strong>施法(🪄)</strong><p>${descriptions.cast} 禁咒(🚫)必须遵守当前裁判的限制；可付费施放时会明确标出费用。</p></div><div><strong>窥探(👁️)</strong><p>${descriptions.peek} 新放置或后来转移到该斗士的暗牌不会自动变成已知。</p></div><div><strong>放弃(✋)</strong><p>${descriptions.pass} 已用完手牌的玩家也停止行动。</p></div><div><strong>信息与魔力(🔮)</strong><p>${descriptions.hidden} ${descriptions.mana}</p></div></div>
            <h3>裁判与结算</h3><p>所有玩家停止行动后，先揭开暗牌，再由裁判(⚖️)处理超限魔力(🔮)：可能移除法术，或令斗士退场。特殊裁判以牌面说明为准。剩余斗士比较最终强度(⚔️)；同值时比较印刷强度。亡灵斗士会反转法术的强度加减，改变赏金法术影响收益。所有斗士都退场则比赛取消，保留结算并追加一轮。</p><p>本桌启用经典可选规则 Foul Play：${descriptions.bribe}</p>
            <h3>轮间与胜利</h3><p>${descriptions.next} ${descriptions.discard} 3–4 人手牌上限 8 张，5–6 人上限 6 张。重新洗斗士并更换裁判，由金币最多者先手。三轮有效比赛后，金币(💰)最多者获胜；相同则剩余手牌(🂠)更多者获胜，仍相同共享胜利。</p>
            <h3>特殊法术参考</h3><div class="cm-help-grid"><div><strong>强度(⚔️)与赏金(💰)</strong><p>强化、削弱、亡灵斗士的强度反转、变形及赏金变化会改变斗士的最终结果。变化以牌面为准，印刷值与已知值分别展示。</p></div><div><strong>驱散与转移(🌀)</strong><p>驱散移除可指定的场上法术；转移需要先选新斗士，再选原法术。反魔法领域(🚫)立刻清除斗士全部法术；明置的反射(🪞)保护斗士及其法术免受新法术影响，反魔法领域例外。</p></div><div><strong>手牌与窥探(👁️)</strong><p>抽牌即时补充手牌。遗忘令指定玩家先完成弃牌后再继续回合。窥探只公开给施法者，弃牌堆始终公开。</p></div><div><strong>押注与裁判(⚖️)</strong><p>换注先选择原押注，再选新的斗士。换裁判和忽略裁判会改变当前判罚条件；界面始终展示生效中的裁判及持续支援。</p></div><div><strong>隐身(🫥)与棱镜(🌈)</strong><p>隐身(🫥)允许本人施放被裁判禁用的法术；棱镜光线(🌈)允许本人将直接法术暗置。被驱散后权限消失。</p></div><div><strong>查看准确牌效(🪄)</strong><p>每张牌的数值、种类、禁咒标记与特殊效果都可用 Explain 查看。未知暗牌只可查看公开信息；结算后所有牌面均可查阅。</p></div></div>
            <h3>完整法术牌表 · 36 种／72 张</h3><div class="cm-help-grid">${spellReference.map(card => `<div><strong>${esc(cardLabel(card))} ×${card.count}</strong><p>${esc(kindNames[card.kind])} · 🔮 ${card.mana}${card.forbidden ? " · 🚫 禁咒" : ""}<br>${esc(card.description)}</p></div>`).join("")}</div>
            <h3>八位裁判(⚖️)</h3><div class="cm-help-grid">${judgeReference.map(judge => `<div><strong>${esc(judge.icon)} ${esc(judge.name_zh)}</strong><p>${esc(judge.description)}</p></div>`).join("")}</div>
            <h3>线上操作</h3><p>先选择手牌和所需目标，再点 Cast 或 Peek；灰色选项不能提交。点击周围空白或按 Esc 撤销未提交的选择。Help 集中查看规则；Explain 开启后点牌、图标或按钮查看解释，期间不会执行游戏行动。非操作信息支持鼠标悬停、键盘聚焦或触屏点击；触屏浮动提示 3 秒后消失。对话框支持 Esc 和点击背景关闭。</p>`);
    }

    function resetSelection() {
        selectedCard = null;
        selectedBets = [];
        selectedDiscards = [];
        choices = {};
        mode = "cast";
    }
    function choiceState() {
        let candidates = moves(mode).filter(move => same(move.card_id, selectedCard));
        const fields = ["target", "spell_id", "player_id", "from_slot", "to_slot", "bribe", "face_down"];
        const rows = [];
        let unresolved = false;
        for (const field of fields) {
            if (!candidates.some(move => Object.hasOwn(move, field))) continue;
            const values = [...new Map(candidates.map(move => [String(move[field] ?? false), move[field] ?? false])).values()];
            let selected = choices[field];
            if (selected !== undefined && !values.some(value => same(value, selected))) delete choices[field];
            selected = choices[field];
            if (values.length === 1 && !unresolved) selected = values[0];
            if (selected !== undefined) candidates = candidates.filter(move => same(move[field] ?? false, selected));
            if (values.length > 1 || field !== "bribe") rows.push({field, values, selected});
            if (selected === undefined) { unresolved = true; break; }
        }
        return {rows, move: !unresolved && candidates.length ? candidates[0] : null};
    }
    function fieldLabel(field, value) {
        if (["target", "from_slot", "to_slot"].includes(field)) return fighterName(value);
        if (field === "player_id") return playerName(value);
        if (field === "bribe") return value ? "Pay 2 💰" : "No fee";
        if (field === "face_down") return value ? "🌙 Face Down" : "☀️ Face Up";
        for (const fighter of view.fighters || []) {
            const spell = (fighter.spells || []).find(item => same(item.id, value));
            if (spell) return `${fighter.slot} · ${spell.card ? cardLabel(spell.card) : "🌙 暗置法术"} · ${playerName(spell.owner)}`;
        }
        const effect = (view.effects || []).find(item => same(item.id, value));
        return effect ? `${cardLabel(effect.card)} · ${effect.target_type === "player" ? playerName(effect.target_id) : "⚖️ 裁判"}` : "🪄 场上法术";
    }
    function renderPlayers() {
        return (view.players || []).map(player => `<article class="cm-player ${player.player_id === view.current_turn ? "is-current" : ""}" ${explainAttr("player")}>
            <div class="cm-player-heading"><strong>${esc(player.name)}${player.player_id === view.you ? " <small>You</small>" : ""}</strong>${info(`💰 ${player.coins}`, descriptions.coins)}</div>
            <div class="cm-badges">${info(`🂠 ${player.hand_count}`, descriptions.hand)}${player.bet_ready ? info(`🎲 ${player.bet_count ?? "✓"}`, descriptions.bet) : "<span>Not bet</span>"}${player.passed ? info("✋ Pass", descriptions.pass) : ""}${player.player_id === view.current_turn && view.phase === "casting" ? "<span>Playing</span>" : ""}${player.invisible ? info("🫥 隐身", "隐身(🫥)：本人可施放被裁判禁用的法术，直到隐身被驱散或本轮结束。") : ""}${player.prismatic ? info("🌈 棱镜", "棱镜(🌈)：本人可以选择将直接法术(☀️)暗置，种类与魔力不变。") : ""}${(view.next_ready || []).includes(player.player_id) ? "<span>Ready</span>" : ""}${player.is_bot ? "<span>Bot</span>" : ""}</div>
        </article>`).join("");
    }
    function spellHtml(spell) {
        const text = spell.card ? cardDescription(spell.card) : `${descriptions.hidden} 施放者：${playerName(spell.owner)}。`;
        const attachments = (spell.attachments || []).map(attachment => attachment.card ? cardLabel(attachment.card) : cardLabel(attachment)).join(" · ");
        return `<span class="cm-spell ${spell.hidden ? "is-hidden" : ""}" ${tipAttrs(text)}>${spell.card ? esc(cardLabel(spell.card)) : "🌙 暗置法术"}<small>${esc(playerName(spell.owner))}${spell.hidden && spell.card ? " · Known to you" : ""}${attachments ? ` · ${esc(attachments)}` : ""}</small></span>`;
    }
    function renderFighters() {
        const betMode = available("bet");
        const targets = selectedCard ? choiceState().rows.find(row => row.field === "target") : null;
        return (view.fighters || []).map(fighter => {
            const ownBet = (view.your_bets || []).includes(fighter.slot);
            const selected = betMode ? selectedBets.includes(fighter.slot) : targets && same(targets.selected, fighter.slot);
            const enabled = betMode || (!pending && targets?.values.some(slot => same(slot, fighter.slot)));
            const result = ["round_end", "game_over"].includes(view.phase) ? view.round_summary?.fighters?.find(item => item.slot === fighter.slot) : null;
            const winner = view.round_summary?.winner_slot === fighter.slot && ["round_end", "game_over"].includes(view.phase);
            const details = `${fighter.icon || "👹"} ${fighter.name_zh || fighter.name}：${fighter.description || ""} 印刷强度(⚔️) ${fighter.power}，赏金(💰) ${fighter.prize}。${betMode ? descriptions.bet : descriptions.target}`;
            return `<article class="cm-fighter ${ownBet ? "is-bet" : ""} ${winner ? "is-winner" : ""}">
                <button type="button" class="cm-fighter-select ${selected ? "is-selected" : ""}" data-cm-fighter="${fighter.slot}" data-cm-explain="${esc(details)}" aria-pressed="${Boolean(selected)}" ${enabled ? "" : "disabled"}>
                    <span class="cm-fighter-top"><b class="cm-fighter-number">${fighter.slot}</b><span class="cm-bet-marker">${winner ? "🏆 Winner" : selected ? "✓ Selected" : ownBet ? "🎲 Your bet" : ""}</span></span>
                    <span class="cm-fighter-icon" aria-hidden="true">${esc(fighter.icon || "👹")}</span><strong class="cm-fighter-name">${esc(fighter.name_zh || fighter.name)}</strong><span class="cm-fighter-en">${esc(fighter.name)}</span>
                </button><div class="cm-fighter-stats">${info(`⚔️ ${result?.power ?? fighter.known_power ?? fighter.power}${fighter.hidden_count ? " + ?" : ""}`, `${descriptions.power} 印刷强度：${fighter.power}。`)}${info(`💰 ${result?.prize ?? fighter.prize}`, descriptions.prize)}${info(`🔮 ${result?.mana ?? fighter.known_mana ?? 0}${fighter.hidden_count ? " + ?" : ""}${fighter.reverse ? " · ↔ 反转" : ""}`, `${descriptions.mana}${fighter.reverse ? " 此斗士受到反转强度影响。" : ""}`)}</div>
                <div class="cm-spells">${(fighter.spells || []).length ? fighter.spells.map(spellHtml).join("") : '<span class="cm-empty-spells">No spells</span>'}</div>
            </article>`;
        }).join("");
    }
    function renderJudge() {
        const judge = ["round_end", "game_over"].includes(view.phase) ? (view.round_summary?.judge || view.judge) : view.judge;
        if (!judge) return "";
        const detail = `${judge.icon || "⚖️"} ${judge.name_zh || judge.name} / ${judge.name || ""}：${judge.description || descriptions.judge}`;
        const verdicts = {disqualify: "退场", remove: "解除法术", dispel: "解除法术", eliminate: "退场", eject: "退场", none: "无处罚"};
        return `<div class="cm-judge"><div class="cm-judge-main"><span class="cm-judge-icon" ${tipAttrs(detail)}>${esc(judge.icon || "⚖️")}</span><div><strong ${tipAttrs(detail)}>⚖️ ${esc(judge.name_zh || judge.name)}</strong><small>${esc(judge.name)}</small></div></div><div class="cm-judge-rules">${info(`🔮 Limit ${judge.limit ?? (judge.special === "random_verdict" ? "?" : "∞")}`, detail)}${info(esc(verdicts[judge.verdict] || (judge.special === "random_verdict" ? "抽牌判罚" : judge.verdict ? "特殊判罚" : "无处罚")), detail)}${judge.bans && (Array.isArray(judge.bans) ? judge.bans.length : true) ? info("🚫 禁咒限制", detail) : ""}</div></div>`;
    }
    function renderHand() {
        const discardMode = moves("discard").length > 0;
        const hand = view.your_hand || [];
        if (!hand.length) return '<p class="cm-muted">No cards in hand.</p>';
        return `<div class="cm-hand">${hand.map(card => {
            const selected = discardMode ? selectedDiscards.includes(card.id) : selectedCard === card.id;
            const enabled = !pending && (discardMode ? moves("discard").some(move => (move.cards || []).includes(card.id)) : moves(mode).some(move => move.card_id === card.id));
            return `<button type="button" class="cm-card cm-kind-${esc(card.kind)} ${selected ? "is-selected" : ""}" data-cm-card="${esc(card.id)}" data-cm-explain="${esc(cardDescription(card))}" aria-pressed="${selected}" ${enabled ? "" : "disabled"}>
                <span class="cm-card-top"><span>${kindIcons[card.kind] || "🪄"} ${card.forbidden ? "🚫" : ""}</span><span>🔮 ${card.mana ?? 0}</span></span>${selected ? '<span class="cm-card-select-mark">✓</span>' : ""}
                <span class="cm-card-icon" aria-hidden="true">${esc(card.icon || "🪄")}</span><strong class="cm-card-name">${esc(card.name_zh || card.name)}</strong><span class="cm-card-en">${esc(card.name)}</span>
                <span class="cm-card-stats">${card.power ? `⚔️ ${signed(card.power)}` : esc(kindNames[card.kind] || "法术")}</span>
            </button>`;
        }).join("")}</div>`;
    }
    function matchingDiscard() {
        return moves("discard").find(move => move.cards.length === selectedDiscards.length && move.cards.every(id => selectedDiscards.includes(id)));
    }
    function matchingBet() {
        return moves("bet").find(move => move.slots.length === selectedBets.length && move.slots.every(slot => selectedBets.includes(slot)));
    }
    function renderActionBox() {
        if (view.phase === "betting") {
            const betReady = ownPlayer()?.bet_ready;
            const slots = betReady ? (view.your_bets || []) : selectedBets;
            return `<section class="cm-box cm-action-box"><div class="cm-section-heading"><h3>Secret Bet</h3>${info("🎲 1–3", descriptions.bet)}</div><div class="cm-selection">${slots.length ? slots.map(slot => `<span>${esc(fighterName(slot))}</span>`).join("") : '<span class="cm-muted">Select fighters in the arena.</span>'}</div><p class="cm-muted">${slots.length ? `Payout ×${slots.length === 1 ? "2" : slots.length === 2 ? "1" : "½ (round up)"}` : "Your choices stay private."}</p><div class="cm-action-footer"><button type="button" class="cm-primary" data-cm-action="bet" ${explainAttr("bet")} ${pending || !matchingBet() ? "disabled" : ""}>${pending ? "Sending…" : betReady ? "Bet Confirmed" : "Confirm Bet"}</button></div></section>`;
        }
        if (moves("discard").length) {
            const sizes = [...new Set(moves("discard").map(move => move.cards.length))].sort((a, b) => a - b);
            const required = sizes.length === 1 ? `${sizes[0]} card${sizes[0] === 1 ? "" : "s"}` : `${sizes[0]}–${sizes.at(-1)} cards`;
            return `<section class="cm-box cm-action-box"><div class="cm-section-heading"><h3>${view.phase === "refill" ? "Refresh Hand" : "Discard"}</h3>${info("🗑️", descriptions.discard)}</div><p class="cm-muted">Select ${required}.</p><div class="cm-selection"><span>${selectedDiscards.length} selected</span></div><div class="cm-action-footer"><button type="button" class="cm-primary" data-cm-action="discard" ${explainAttr("discard")} ${pending || !matchingDiscard() ? "disabled" : ""}>${pending ? "Sending…" : selectedDiscards.length ? "Confirm Discard" : "Keep All & Draw"}</button></div></section>`;
        }
        if (view.phase !== "casting") return `<section class="cm-box"><h3>Waiting</h3><p class="cm-muted">${view.game_over ? "The game is complete." : "Waiting for the other players."}</p></section>`;
        const state = choiceState();
        const selected = (view.your_hand || []).find(card => card.id === selectedCard);
        const rowLabels = {target: "Target Fighter", spell_id: "Target Spell", player_id: "Target Player", from_slot: "Move Bet From", to_slot: "Move Bet To", bribe: "Casting Cost", face_down: "Visibility"};
        return `<section class="cm-box cm-action-box"><div class="cm-section-heading"><h3>Your Move</h3>${info("🪄", descriptions.cast)}</div>
            <div class="cm-mode-tabs"><button type="button" data-cm-mode="cast" aria-pressed="${mode === "cast"}" ${explainAttr("cast")} ${available("cast") ? "" : "disabled"}>Cast</button><button type="button" data-cm-mode="peek" aria-pressed="${mode === "peek"}" ${explainAttr("peek")} ${available("peek") ? "" : "disabled"}>Peek</button></div>
            <div class="cm-selected-name">${selected ? esc(cardLabel(selected)) : '<span class="cm-muted">Select a card from your hand.</span>'}</div>
            ${selected ? state.rows.map(row => `<div class="cm-choice-label">${rowLabels[row.field]}</div><div class="cm-options">${row.values.map(value => `<button type="button" data-cm-choice="${row.field}" data-cm-value="${esc(value)}" aria-pressed="${row.selected !== undefined && same(row.selected, value)}" ${explainAttr(row.field)} ${pending ? "disabled" : ""}>${esc(fieldLabel(row.field, value))}</button>`).join("")}</div>`).join("") : ""}
            <div class="cm-action-footer"><button type="button" class="cm-primary" data-cm-action="commit" ${explainAttr(mode)} ${pending || !selected || !state.move ? "disabled" : ""}>${pending ? "Sending…" : mode === "peek" ? "Peek" : `Cast${state.move?.bribe ? " · 2 💰" : ""}`}</button><button type="button" data-cm-action="pass" ${explainAttr("pass")} ${available("pass") ? "" : "disabled"}>Pass</button></div></section>`;
    }
    function renderResult() {
        const summary = view.round_summary;
        if (!summary || !["round_end", "game_over"].includes(view.phase)) return "";
        const winners = Array.isArray(view.winner) ? view.winner : view.winner ? [view.winner] : [];
        const winner = view.game_over ? `${winners.map(playerName).join(" / ")} · ${"🏆"}` : summary.cancelled ? "比赛取消 · All fighters out" : `🏆 ${fighterName(summary.winner_slot)}`;
        const verdictNames = {eject: "退场", dispel: "法术解除", safe: "安全", passed: "通过", disqualified: "退场", eliminated: "退场", removed: "法术解除", dispelled: "法术解除", none: "无处罚", ok: "通过"};
        return `<section class="cm-result" ${explainAttr("result")}><div class="cm-section-heading"><h3>${view.game_over ? "Game Over" : "Round Review"}</h3><span>Round ${summary.round}</span></div><strong class="cm-result-winner">${esc(winner)}</strong>
            <div class="cm-result-fighters">${(summary.fighters || []).map(fighter => `<div class="cm-result-fighter"><strong>${fighter.slot} · ${esc(fighter.icon || "👹")} ${esc(fighter.name_zh || fighter.name)}</strong><span>⚔️ ${fighter.power} · 🔮 ${fighter.mana}</span><span>${esc(verdictNames[fighter.verdict] || fighter.verdict || "通过")}</span></div>`).join("")}</div>
            <div class="cm-earnings">${(summary.earnings || []).map(earning => `<div class="cm-earning"><span>${esc(playerName(earning.player_id))}<small>🎲 ${(earning.bets || []).join(" · ") || "—"}</small></span><b>💰 ${signed(earning.amount)}</b></div>`).join("")}</div>
            ${!view.game_over ? `<div class="cm-result-confirm"><span>Ready ${(view.next_ready || []).length} / ${(view.players || []).length}${summary.final ? " · Final round" : ""}</span><button type="button" class="cm-primary" data-cm-action="next_round" ${explainAttr("next")} ${available("next_round") ? "" : "disabled"}>${(view.next_ready || []).includes(view.you) ? "Waiting…" : "Next Round"}</button></div>` : ""}</section>`;
    }
    function renderEffects() {
        if (!(view.effects || []).length) return "";
        return `<div class="cm-badges" style="margin-bottom:12px">${view.effects.map(effect => info(`${esc(cardLabel(effect.card))} · ${esc(effect.target_type === "player" ? playerName(effect.target_id) : "⚖️ 裁判")}`, cardDescription(effect.card))).join("")}</div>`;
    }
    function render() {
        if (!view) return;
        const oldScroll = panel.querySelector(".cm-log")?.scrollTop || 0;
        const phaseNames = {betting: view.current_turn === view.you ? "Your turn · Place your secret bet" : `Waiting for ${playerName(view.current_turn)} to bet`, casting: view.current_turn === view.you ? "Your turn · Shape the odds" : `Waiting for ${playerName(view.current_turn)}`, discarding: moves("discard").length ? "Choose a card to discard" : "Waiting for a discard", refill: "Prepare your next hand", round_end: "Review the result · Confirm when ready", game_over: "Game complete"};
        panel.innerHTML = `<div class="cm-surface"><div class="cm-banner"><div class="cm-brand"><span class="cm-brand-mark" ${tipAttrs("诈赌巫师(🧙)：秘密押注斗士，用法术改变战果。")}>🧙</span><div><span class="cm-eyebrow">MAGIC. MISCHIEF. MONEY.</span><h2>诈赌巫师<small>Cheaty Mages!</small></h2></div></div><div class="cm-round">ROUND<b>${view.round} <small>/ ${view.total_rounds || 3}</small></b></div></div>
            <div class="cm-status-row"><div class="cm-status" role="status" aria-live="polite">${esc(pending ? "Sending…" : phaseNames[view.phase] || view.phase)}</div><div class="cm-stats">${info(`🂠 ${view.deck_count ?? 0} Deck`, descriptions.deck)}${info(`🗑️ ${(view.discard || []).length}`, descriptions.discardPile)}</div></div>
            <div class="cm-players">${renderPlayers()}</div>${renderResult()}${renderJudge()}${renderEffects()}<div class="cm-arena">${renderFighters()}</div>
            ${!view.game_over && view.phase !== "round_end" ? `<div class="cm-workspace"><section class="cm-box"><div class="cm-section-heading"><h3>Your Spells</h3>${info("🔒 Private hand", descriptions.hand)}</div>${renderHand()}<p class="cm-hand-caption">${info("☀️ 直接", "直接(☀️)：公开施放在斗士身上。")} · ${info("🌙 赋予", "赋予(🌙)：暗置在斗士身上；施放者及已窥探者可看牌面。")} · ${info("✨ 支援", "支援(✨)：按法术效果即时处理或保持在场。")} · ${info("🚫 禁咒", "禁咒(🚫)：是否允许施放由当前裁判决定。")}</p></section>${renderActionBox()}</div>` : ""}
            <details class="cm-history" ${historyOpen ? "open" : ""}><summary>Round Log & Discard Pile</summary><div class="cm-history-content"><section class="cm-box"><div class="cm-section-heading"><h3>Round Log</h3>${info("📜", descriptions.log)}</div><div class="cm-log">${(view.log || []).slice().reverse().map(entry => `<p><small>R${entry.round} · T${entry.turn}</small>${esc(entry.text)}</p>`).join("") || '<p class="cm-muted">No actions yet.</p>'}</div></section><section class="cm-box"><div class="cm-section-heading"><h3>Discard Pile</h3>${info("🗑️", descriptions.discardPile)}</div><div class="cm-discards">${(view.discard || []).map(card => `<span class="cm-discard" ${tipAttrs(cardDescription(card))}>${esc(cardLabel(card))}</span>`).join("") || '<span class="cm-muted">No discarded spells.</span>'}</div></section></div></details></div>`;
        const log = panel.querySelector(".cm-log");
        if (log) log.scrollTop = oldScroll;
        panel.querySelector(".cm-history")?.addEventListener("toggle", event => { historyOpen = event.target.open; });
    }
    function submit(move) {
        if (pending || !move) return;
        pending = true;
        hideTip();
        render();
        sendAction({...move});
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pending = false; render(); }, 5000);
    }
    function choose(field, rawValue) {
        const state = choiceState(), row = state.rows.find(item => item.field === field);
        const value = row?.values.find(item => same(item, rawValue));
        if (value === undefined) return;
        const fields = ["target", "spell_id", "player_id", "from_slot", "to_slot", "bribe", "face_down"];
        for (const key of fields.slice(fields.indexOf(field) + 1)) delete choices[key];
        choices[field] = value;
        render();
    }
    panel.addEventListener("click", event => {
        if (explaining || !view) return;
        const button = event.target.closest("button");
        if (button) {
            if (button.disabled || pending) return;
            if (button.dataset.cmFighter) {
                const slot = Number(button.dataset.cmFighter);
                if (available("bet")) {
                    if (selectedBets.includes(slot)) selectedBets = selectedBets.filter(item => item !== slot);
                    else if (selectedBets.length < 3) selectedBets.push(slot);
                    render();
                } else choose("target", slot);
            } else if (button.dataset.cmCard) {
                const id = button.dataset.cmCard;
                if (moves("discard").length) {
                    if (selectedDiscards.includes(id)) selectedDiscards = selectedDiscards.filter(item => item !== id);
                    else {
                        const max = Math.max(...moves("discard").map(move => move.cards.length));
                        if (max === 1) selectedDiscards = [id];
                        else if (selectedDiscards.length < max) selectedDiscards.push(id);
                    }
                } else { selectedCard = selectedCard === id ? null : id; choices = {}; }
                render();
            } else if (button.dataset.cmMode) { mode = button.dataset.cmMode; choices = {}; render(); }
            else if (button.dataset.cmChoice) choose(button.dataset.cmChoice, button.dataset.cmValue);
            else if (button.dataset.cmAction === "bet") submit(matchingBet());
            else if (button.dataset.cmAction === "discard") submit(matchingDiscard());
            else if (button.dataset.cmAction === "commit") submit(choiceState().move);
            else if (button.dataset.cmAction) submit(moves(button.dataset.cmAction)[0]);
            return;
        }
        const target = event.target.closest("[data-cm-tip]");
        if (target) showTip(target, true);
        else if (!event.target.closest(".cm-history, .cm-result") && !pending && (selectedCard || selectedBets.length || selectedDiscards.length)) { resetSelection(); hideTip(); render(); }
    });
    function explainAt(event) {
        let element = event.target.closest?.("[data-cm-explain]");
        if (!element && event.type === "pointerdown") {
            element = [...panel.querySelectorAll("button:disabled[data-cm-explain]")].find(button => {
                const rect = button.getBoundingClientRect();
                return rect.width > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
            });
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!element) return;
        const text = element.dataset.cmExplain;
        setExplain(false);
        if (event.type === "pointerdown") suppressUntil = performance.now() + 700;
        openDialog("Explain", `<p>${esc(text)}</p>`);
    }
    document.addEventListener("pointerdown", event => {
        if (!explaining || event.target.closest("#cheatyMagesHelpBtn, #cheatyMagesExplainBtn, .cm-dialog")) return;
        explainAt(event);
    }, true);
    document.addEventListener("click", event => {
        if (performance.now() < suppressUntil) {
            suppressUntil = 0;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (!explaining || event.target.closest("#cheatyMagesHelpBtn, #cheatyMagesExplainBtn, .cm-dialog")) return;
        explainAt(event);
    }, true);
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-cm-tip]")); });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-cm-tip]")));
    panel.addEventListener("focusout", hideTip);
    panel.addEventListener("keydown", event => {
        if (!["Enter", " "].includes(event.key) || !event.target.matches("[data-cm-tip]")) return;
        event.preventDefault();
        if (explaining) explainAt(event);
        else showTip(event.target, true);
    });
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        setExplain(false);
        hideTip();
        if (!dialog.open && !pending && view) { resetSelection(); render(); }
    });
    helpButton.addEventListener("click", help);
    explainButton.addEventListener("click", () => setExplain(!explaining));
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    document.addEventListener("scroll", hideTip, true);

    window.renderCheatyMagesGameState = data => {
        const next = data?.view || data;
        if (!next || next.game_id !== "cheaty_mages") return;
        const nextSignature = JSON.stringify([data.room_id, next.you, next.round, next.turn, next.phase]);
        if (signature !== nextSignature) { resetSelection(); hideTip(); }
        signature = nextSignature;
        view = next;
        pending = false;
        clearTimeout(pendingTimer);
        if (mode === "cast" && !moves("cast").length && moves("peek").length) mode = "peek";
        render();
    };
    window.showCheatyMagesHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) {
            view = null; signature = null; pending = false;
            resetSelection(); setExplain(false); hideTip();
            clearTimeout(pendingTimer);
            if (dialog.open) dialog.close();
            panel.innerHTML = "";
        }
    };
    function connectEvents() {
        if (typeof socket !== "undefined") socket.on("system:error", () => {
            if (pending) { pending = false; clearTimeout(pendingTimer); render(); }
        });
        if (typeof currentRoomState !== "undefined" && currentRoomState && typeof renderRoomState === "function") renderRoomState(currentRoomState);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    else connectEvents();
})();
