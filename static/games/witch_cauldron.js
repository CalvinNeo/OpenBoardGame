(() => {
    "use strict";

    const panel = document.getElementById("witchCauldronPanel");
    const header = document.getElementById("witchCauldronHeaderActions");
    const helpButton = document.getElementById("witchCauldronHelpBtn");
    const explainButton = document.getElementById("witchCauldronExplainBtn");
    if (!panel || !header || !helpButton || !explainButton) return;

    const COLOR = {
        red: {icon: "🔴", label: "红色", labelEn: "Red"},
        blue: {icon: "🔵", label: "蓝色", labelEn: "Blue"},
        neutral: {icon: "⚪", label: "中性", labelEn: "Neutral"},
        special: {icon: "✨", label: "特殊", labelEn: "Special"},
    };
    const OUTCOME = {
        perfect: {icon: "🌟", zh: "完美汤药", en: "Perfect Potion"},
        safe_red: {icon: "🍲", zh: "安全红汤", en: "Safe Red Soup"},
        safe_blue: {icon: "🥣", zh: "安全蓝汤", en: "Safe Blue Soup"},
        explode: {icon: "💥", zh: "炸锅", en: "Explosion"},
        poison: {icon: "☠️", zh: "中毒", en: "Poison"},
        refused: {icon: "🚫", zh: "拒绝饮用", en: "Refused"},
    };

    const HELP = {
        zh: {
            title: "Help · 女巫坩埚",
            tabs: ["基本规则", "一轮流程", "计分", "特殊卡牌", "线上操作"],
            basic: `
                <p><strong>靠什么赢：</strong>活到最后并把秘药熬好，每轮把坩埚里配平的药材收进计分牌堆，先达到胜利分数（2–5 人局 7 分(🏆)、6–7 人局 5 分(🏆)）或成为唯一幸存者就获胜。</p>
                <p><strong>每圈做什么：</strong>先从展示区轮抽一张药材卡(🌿)加入手牌，再从两张手牌里打出一张，可以放进自己的坩埚(🫕)也可以塞进别人的坩埚(🫕)。</p>
                <p><strong>玩这个游戏的重点：</strong>红色药材(🔴)烈性高、蓝色药材(🔵)毒性高，两边数值越接近越好喝，所以既要守住自己锅里的红蓝平衡，也要看准对手缺哪一边给他补上一刀。</p>
                <p>红色值与蓝色值的差值(📊)不超过 3 就能安全得分，差值为 0 的完美汤药(🌟)会让锅里所有药材都得分；差值超过 3 就会炸锅(💥)或中毒(☠️)，同一种标记拿到两枚就直接出局。</p>`,
            flow: `
                <ol>
                    <li><strong>汤底：</strong>每轮开始时每位存活玩家拿两张牌，选一张正面朝上放在自己面前当作这锅秘药的汤底，另一张留在手里。</li>
                    <li><strong>轮抽：</strong>从中央牌库翻开「存活人数 + 1」张牌摆成展示区，从起始玩家开始顺时针每人拿走一张，最后剩下的那一张直接进入弃牌堆。</li>
                    <li><strong>下锅：</strong>同样从起始玩家开始顺时针，每位玩家打出一张手牌，可以选择明置或暗置，也可以选择放进任意一名对手的坩埚。</li>
                    <li><strong>圈数：</strong>2–5 人局每轮进行 4 圈，6–7 人局每轮进行 3 圈，每圈结束后起始玩家标记顺时针传给下一位。</li>
                    <li><strong>加不加：</strong>最后一圈结束时手上还会剩一张牌，你可以把它加进自己的坩埚，也可以直接弃掉。</li>
                    <li><strong>换不换：</strong>如果你和另一位玩家都向对方提出了交换，两人的整锅坩埚就会对调。</li>
                    <li><strong>喝不喝：</strong>每位玩家公开宣布喝不喝这锅秘药。不喝要把整锅倒进弃牌堆并拿走一枚拒绝指示物(🚫)，整局每人只有一次拒绝机会。</li>
                </ol>`,
            score: `
                <p>喝下秘药后同时翻开锅里所有暗置的牌，把红色药材(🔴)的数值相加得到红色值，把蓝色药材(🔵)的数值相加得到蓝色值，再取两者差值(📊)。中性药材虚空幽质(🌀)数值为 0，两边都算它一份。</p>
                <ul>
                    <li>差值为 0：完美汤药(🌟)，锅里所有药材各得 1 分。</li>
                    <li>差值不超过 3 且红色更高：安全红汤(🍲)，所有红色药材和中性药材各得 1 分。</li>
                    <li>差值不超过 3 且蓝色更高：安全蓝汤(🥣)，所有蓝色药材和中性药材各得 1 分。</li>
                    <li>差值超过 3 且红色更高：炸锅(💥)，拿一枚爆炸指示物，本锅不得分。</li>
                    <li>差值超过 3 且蓝色更高：中毒(☠️)，拿一枚中毒指示物，本锅不得分。</li>
                </ul>
                <p>结算后把得分的牌面朝下收进计分牌堆，每张记 1 分，其余的牌连同所有特殊卡牌(✨)一起进入弃牌堆。</p>`,
            cards: `
                <p>特殊卡牌(✨)不算药材，结算时永远不计分，但效果强制触发。除变色龙尾巴(🦎)外，所有特殊卡牌被打出时都必须正面朝上。</p>
                <ul>
                    <li><strong>锅盖(🫕)：</strong>打出后这锅就被封存，任何人都不能再往里加牌。给自己可以挡住暗算，给对手则等于宣判这锅已经定死。</li>
                    <li><strong>变色龙尾巴(🦎)：</strong>结算时你可以自选把红色值或蓝色值减去 1，常常能把一锅差 1 的汤药救成完美汤药。</li>
                    <li><strong>真名血契(🩸)：</strong>锅里有这张牌的玩家必须喝下秘药，不能拒绝。</li>
                    <li><strong>预言触须(🐙)：</strong>打出时可以偷看这锅里任意一张暗置的盖牌，线上版会把那张牌只显示给你一个人。</li>
                    <li><strong>潮汐引力石(🪨)：</strong>打出后这锅立刻从中央牌库顶补进一张牌，而且补进来的牌必须明置。</li>
                    <li><strong>噬火巨龙鳞(🐉)：</strong>让差值超过 3 的炸锅红汤(💥)变成安全红汤(🍲)，但只要这锅是蓝汤就会变成剧毒汤，喝下直接中毒(☠️)。</li>
                    <li><strong>巨鲸凝毒脂(🛢️)：</strong>让差值超过 3 的毒蓝汤(☠️)变成安全蓝汤(🥣)，但只要这锅是红汤就会炸锅(💥)。</li>
                    <li><strong>衔尾蛇(🐍)：</strong>在宣布喝不喝之前，所有锅里有这张牌的玩家按顺时针把整锅交换给下一位同样持有者。</li>
                    <li><strong>换汤不换药(🔄)：</strong>结算时这锅秘药转换成另一种属性，红汤按蓝色药材计分、蓝汤按红色药材计分，完美汤药不受影响。</li>
                </ul>
                <p>噬火巨龙鳞(🐉)与巨鲸凝毒脂(🛢️)同时出现在同一锅里会互相抵消，等于两张都没生效。</p>`,
            online: `
                <p>先点选一张手牌，再点选要放入的坩埚，坩埚上会弹出明置或暗置的确认层；点击面板空白处即可取消当前选择。</p>
                <p>数值 4 和 5 的药材卡在左上角带有箭头标记，它们打进别人的坩埚时必须明置，只有放进自己的坩埚才可以暗置。</p>
                <p>你不能随时翻看自己锅里暗置的牌，只有预言触须(🐙)能看到它们；其他玩家暗置的牌同样对你保密。</p>
                <p>按 Explain 后再点任意控件可以查看它的说明，Explain 模式下不会执行任何游戏操作，按 Esc 或再点一次 Explain 退出。所有弹窗都可以用 Esc 关闭。</p>
                <p>桌面上把鼠标悬停在图标上、手机上轻点图标，都会弹出三秒说明。</p>`,
        },
        en: {
            title: "Help · Witch's Cauldron",
            tabs: ["Basics", "Round", "Scoring", "Special Cards", "Online"],
            basic: `
                <p><strong>How you win:</strong> survive and brew well. Every round the balanced ingredients in your cauldron move to your score pile, and you win by reaching the target first (7 points (🏆) at 2–5 players, 5 points (🏆) at 6–7 players) or by being the last witch standing.</p>
                <p><strong>What you do each circle:</strong> first draft one ingredient card (🌿) from the display, then play one of your two hand cards into your own cauldron (🫕) or into a rival's cauldron (🫕).</p>
                <p><strong>What matters most:</strong> red ingredients (🔴) are fiery and blue ingredients (🔵) are toxic, so the closer the two totals the better the brew. Guard your own balance while pushing a rival towards the colour they already have too much of.</p>
                <p>A difference (📊) of 3 or less is drinkable, and a difference of exactly 0 is a perfect potion (🌟) that scores every ingredient. Above 3 the cauldron explodes (💥) or poisons (☠️) you, and two markers of the same kind end your game.</p>`,
            flow: `
                <ol>
                    <li><strong>Soup base:</strong> at the start of every round each surviving witch takes two cards, places one face up as the base of her cauldron and keeps the other in hand.</li>
                    <li><strong>Draft:</strong> reveal "survivors + 1" cards from the central deck, then starting with the start player each witch takes one clockwise. The single leftover card goes to the discard pile.</li>
                    <li><strong>Brew:</strong> again clockwise from the start player, each witch plays one hand card face up or face down into any cauldron, her own or a rival's.</li>
                    <li><strong>Circles:</strong> a round is 4 circles at 2–5 players and 3 circles at 6–7 players, and the start player marker passes clockwise after each circle.</li>
                    <li><strong>Keep or bin:</strong> after the last circle you still hold one card and may add it to your own cauldron or discard it.</li>
                    <li><strong>Trade:</strong> if you and another witch both propose each other, your two cauldrons swap entirely.</li>
                    <li><strong>Drink:</strong> everyone publicly drinks or refuses. Refusing dumps your whole cauldron into the discard pile and takes a refusal token (🚫), which each witch may use only once per game.</li>
                </ol>`,
            score: `
                <p>After drinking, reveal every face-down card. Add the red ingredient (🔴) values for the red total and the blue ingredient (🔵) values for the blue total, then take the difference (📊). The neutral Void Ether (🌀) is worth 0 and counts for both sides.</p>
                <ul>
                    <li>Difference 0: perfect potion (🌟), every ingredient in the cauldron scores 1.</li>
                    <li>Difference 3 or less with red ahead: safe red soup (🍲), every red and neutral ingredient scores 1.</li>
                    <li>Difference 3 or less with blue ahead: safe blue soup (🥣), every blue and neutral ingredient scores 1.</li>
                    <li>Difference above 3 with red ahead: explosion (💥), take an explosion token and score nothing.</li>
                    <li>Difference above 3 with blue ahead: poison (☠️), take a poison token and score nothing.</li>
                </ul>
                <p>Scoring cards go face down into your score pile at 1 point each, and everything else, including all special cards (✨), goes to the discard pile.</p>`,
            cards: `
                <p>Special cards (✨) are not ingredients and never score, but their effects always trigger. Apart from the Chameleon Tail (🦎), every special card must be played face up.</p>
                <ul>
                    <li><strong>The Cauldron Lid (🫕):</strong> seals that cauldron so nobody can add another card. On yourself it blocks sabotage; on a rival it freezes a cauldron you already like.</li>
                    <li><strong>Chameleon Tail (🦎):</strong> at scoring you may subtract 1 from either the red or the blue total, often turning a near miss into a perfect potion.</li>
                    <li><strong>Blood Oath (🩸):</strong> whoever owns this cauldron must drink and cannot refuse.</li>
                    <li><strong>Prophetic Tendril (🐙):</strong> on play you look at one face-down card in that cauldron; online it is revealed to you alone.</li>
                    <li><strong>Tide-Weaver Stone (🪨):</strong> immediately adds the top card of the central deck to that cauldron, face up.</li>
                    <li><strong>Fire-Eater Scale (🐉):</strong> turns a red soup that would explode (💥) into a safe red soup (🍲), but any blue soup becomes lethal and poisons (☠️) you.</li>
                    <li><strong>Abyssal Leviathan Oil (🛢️):</strong> turns a blue soup that would poison (☠️) into a safe blue soup (🥣), but any red soup explodes (💥).</li>
                    <li><strong>Ouroboros (🐍):</strong> before the drink decision, every cauldron holding this card passes clockwise to the next holder.</li>
                    <li><strong>Color Negator (🔄):</strong> at scoring the soup flips to the other colour, so a red soup scores blue ingredients and vice versa; a perfect potion is unaffected.</li>
                </ul>
                <p>A Fire-Eater Scale (🐉) and an Abyssal Leviathan Oil (🛢️) in the same cauldron cancel each other out completely.</p>`,
            online: `
                <p>Tap a hand card, then tap the cauldron you want to feed. A confirmation layer appears on that cauldron offering a face-up or face-down play. Tapping empty space cancels the selection.</p>
                <p>Ingredient cards with value 4 or 5 carry an arrow marker: they must be face up in another player's cauldron and may only be hidden in your own.</p>
                <p>You cannot look at your own face-down cards at will; only the Prophetic Tendril (🐙) reveals them, and rival face-down cards stay hidden from you too.</p>
                <p>Press Explain and then any control to read its description. Explain never performs a game action, and Esc or a second press leaves the mode. Every dialog closes with Esc.</p>
                <p>Hover an icon on desktop or tap it on mobile to see a three second description.</p>`,
        },
    };

    const EXPLANATIONS = {
        status: "红蓝差值不超过 3 就能安全得分，超过 3 就会炸锅或中毒。同一种标记累计两枚就被淘汰。",
        display: "展示区会翻开「存活人数 + 1」张牌，从起始玩家开始顺时针每人拿一张，最后剩下的一张进入弃牌堆。",
        hand: "每圈轮抽后你会有两张手牌，下锅时打出一张，轮末还会剩一张决定加不加。",
        cauldron: "坩埚里红色值与蓝色值越接近越好。点选手牌后再点选这里可以把这张牌下锅。",
        sealed: "锅盖封存了这锅，任何人都不能再往里加牌。",
        score: "计分牌堆里每张牌记 1 分，达到胜利分数就赢。",
        explode: "红色过高会炸锅，累计两枚爆炸指示物就出局。",
        poison: "蓝色过高会中毒，累计两枚中毒指示物就出局。",
        refuse: "拒绝指示物整局每人只能用一次，用掉后这锅所有牌直接进弃牌堆。",
        faceUp: "明置下锅，所有玩家都能看到这张牌。",
        faceDown: "暗置下锅，只有下锅的人自己知道；你自己也不能随时翻看。",
        drink: "喝下秘药才会结算分数，不喝则整锅倒掉并消耗你唯一的拒绝机会。",
        next: "确认已经看过本轮结算，所有玩家都确认后才进入下一轮。",
        chameleon: "变色龙尾巴让你自选把红色值或蓝色值减 1。",
        swap: "只有双方都向对方提出交换时，两锅才会真正对调。",
    };

    let view = null;
    let selectedCard = null;
    let selectedTarget = null;
    let proposedSwap = null;
    let pending = false;
    let pendingTimer = null;
    let explaining = false;
    let signature = null;
    let lastPointerType = "mouse";
    let tipTimer = null;
    let returnFocus = null;
    let helpLang = "zh";
    let helpTab = 0;

    const dialog = document.createElement("dialog");
    dialog.id = "witchCauldronDialog";
    dialog.className = "witch-cauldron-dialog";
    dialog.innerHTML = '<div class="witch-cauldron-dialog-head"><h2></h2><div class="witch-cauldron-dialog-tools"><button type="button" class="witch-cauldron-lang">EN</button><button type="button" class="witch-cauldron-dialog-close">Close</button></div></div><div class="witch-cauldron-tabs"></div><div class="witch-cauldron-dialog-body"></div>';
    document.body.append(dialog);
    const dialogTitle = dialog.querySelector("h2");
    const dialogBody = dialog.querySelector(".witch-cauldron-dialog-body");
    const dialogTabs = dialog.querySelector(".witch-cauldron-tabs");
    const dialogClose = dialog.querySelector(".witch-cauldron-dialog-close");
    const dialogLang = dialog.querySelector(".witch-cauldron-lang");

    const tip = document.createElement("div");
    tip.className = "witch-cauldron-tip";
    tip.hidden = true;
    tip.setAttribute("role", "status");
    document.body.append(tip);

    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
    const me = () => view?.players.find(player => player.player_id === view.you);
    const legal = action => !pending && !!view?.legal_actions?.includes(action);
    const playerById = id => view?.players.find(player => player.player_id === id);
    const nameOf = id => playerById(id)?.name || "—";
    const cardKey = card => card.instance || card.id;

    function cardTone(card) {
        if (!card) return "back";
        return card.kind === "special" ? "special" : card.color;
    }

    function cardTip(card) {
        if (!card) return "暗置的牌，只有下锅的人知道是什么。";
        if (card.kind === "special") return `${card.name_zh}(${card.icon})：${card.text_zh}`;
        const tone = COLOR[card.color];
        return `${card.name_zh}(${card.icon})：${tone.label}药材，数值 ${card.value}。`;
    }

    function cardHTML(card, options = {}) {
        const tone = cardTone(card);
        const known = options.known ? " is-known" : "";
        const reveal = card?.must_reveal ? '<span class="witch-cauldron-mark" title="必须明牌">👁</span>'
            : card?.reveal_to_others ? '<span class="witch-cauldron-mark" title="给别人必须明牌">⬆️</span>' : "";
        const badge = card && card.kind === "ingredient" ? `<span class="witch-cauldron-value">${card.value}</span>` : "";
        const body = card
            ? `<span class="witch-cauldron-icon">${card.icon}</span><span class="witch-cauldron-name">${esc(card.name_zh)}</span>`
            : '<span class="witch-cauldron-back">🫕</span>';
        return `<div class="witch-cauldron-card tone-${tone}${known}${options.selected ? " is-selected" : ""}${options.small ? " is-small" : ""}" ${options.attrs || ""}><span class="witch-cauldron-corner">${reveal}</span>${badge}${body}</div>`;
    }

    function cauldronHTML(player) {
        const isMe = player.player_id === view.you;
        const targetable = !!selectedCard && legal("play_card") && player.alive && !player.sealed;
        const mask = selectedTarget === player.player_id
            ? `<div class="witch-cauldron-mask"><button type="button" data-wc-play="up" data-wc-explain="${esc(EXPLANATIONS.faceUp)}">明置下锅</button><button type="button" data-wc-play="down" data-wc-explain="${esc(EXPLANATIONS.faceDown)}" ${view.forceReveal ? "disabled" : ""}>暗置下锅</button></div>`
            : "";
        const tokens = `<span class="witch-cauldron-token" data-wc-tip="${esc(EXPLANATIONS.explode)}">💥 ${player.explosions}</span><span class="witch-cauldron-token" data-wc-tip="${esc(EXPLANATIONS.poison)}">☠️ ${player.poisons}</span><span class="witch-cauldron-token" data-wc-tip="${esc(EXPLANATIONS.refuse)}">🚫 ${player.refused ? "1" : "0"}</span>`;
        const cards = player.cauldron.length
            ? player.cauldron.map(entry => cardHTML(entry.card, {small: true, known: entry.known, attrs: `data-wc-tip="${esc(cardTip(entry.card))}"`})).join("")
            : '<span class="witch-cauldron-empty">空锅</span>';
        return `<section class="witch-cauldron-pot${isMe ? " is-me" : ""}${player.alive ? "" : " is-out"}${targetable ? " is-target" : ""}${selectedTarget === player.player_id ? " is-chosen" : ""}" data-wc-pot="${esc(player.player_id)}" data-wc-explain="${esc(EXPLANATIONS.cauldron)}">
            <header class="witch-cauldron-pot-head">
                <span class="witch-cauldron-pot-name">${esc(player.name)}${isMe ? " (你)" : ""}${player.alive ? "" : " · 出局"}</span>
                <span class="witch-cauldron-pot-score" data-wc-tip="${esc(EXPLANATIONS.score)}">🏆 ${player.total}</span>
            </header>
            <div class="witch-cauldron-tokens">${tokens}${player.sealed ? '<span class="witch-cauldron-token is-sealed" data-wc-tip="' + esc(EXPLANATIONS.sealed) + '">🫕 已封存</span>' : ""}</div>
            <div class="witch-cauldron-cards">${cards}</div>${mask}
        </section>`;
    }

    function stageLine() {
        const round = `第 ${view.round} 轮 · 第 ${view.circle}/${view.circles} 圈`;
        const map = {
            setup: "选择一张牌作为汤底",
            draft: view.current_player === view.you ? "轮抽：轮到你选牌" : `轮抽：等待 ${nameOf(view.current_player)}`,
            play: view.current_player === view.you ? "下锅：轮到你出牌" : `下锅：等待 ${nameOf(view.current_player)}`,
            add: "加不加：最后一张牌",
            swap: "换不换：提出交换",
            drink: "喝不喝：公开宣布",
            chameleon: "变色龙尾巴：选择减哪一种颜色",
            scoring: "本轮结算",
            game_over: "游戏结束",
        };
        return `${round} · ${map[view.stage] || ""}`;
    }

    function trayHTML() {
        if (view.stage === "setup") {
            return `<div class="witch-cauldron-tray-head">选择一张牌正面朝上作为你这一锅的汤底</div>
                <div class="witch-cauldron-hand">${view.hand.map(card => cardHTML(card, {selected: selectedCard === cardKey(card), attrs: `data-wc-card="${esc(cardKey(card))}" data-wc-tip="${esc(cardTip(card))}"`})).join("")}</div>
                ${selectedCard ? '<div class="witch-cauldron-actions"><button type="button" data-wc-setup="1">作为汤底</button></div>' : ""}`;
        }
        if (view.stage === "draft") {
            const mine = view.current_player === view.you;
            return `<div class="witch-cauldron-tray-head" data-wc-explain="${esc(EXPLANATIONS.display)}">展示区 · ${mine ? "轮到你选一张" : "等待 " + esc(nameOf(view.current_player)) + " 选牌"}</div>
                <div class="witch-cauldron-display">${view.display.map(card => cardHTML(card, {attrs: `data-wc-draft="${esc(cardKey(card))}" data-wc-tip="${esc(cardTip(card))}"`})).join("") || '<span class="witch-cauldron-empty">展示区已空</span>'}</div>
                <div class="witch-cauldron-tray-head" data-wc-explain="${esc(EXPLANATIONS.hand)}">你的手牌</div>
                <div class="witch-cauldron-hand">${view.hand.map(card => cardHTML(card, {small: true, attrs: `data-wc-tip="${esc(cardTip(card))}"`})).join("")}</div>`;
        }
        if (view.stage === "play") {
            const mine = view.current_player === view.you;
            return `<div class="witch-cauldron-tray-head" data-wc-explain="${esc(EXPLANATIONS.hand)}">${mine ? "选择一张手牌，再点选要放入的坩埚" : "等待 " + esc(nameOf(view.current_player)) + " 出牌"}</div>
                <div class="witch-cauldron-hand">${view.hand.map(card => cardHTML(card, {selected: selectedCard === cardKey(card), attrs: `data-wc-card="${esc(cardKey(card))}" data-wc-tip="${esc(cardTip(card))}"`})).join("")}</div>`;
        }
        if (view.stage === "add") {
            const done = view.pending_add;
            return `<div class="witch-cauldron-tray-head">${done ? "已经提交，等待其他女巫" : "最后一张牌：加进自己的坩埚，还是弃掉？"}</div>
                <div class="witch-cauldron-hand">${view.hand.map(card => cardHTML(card, {small: true, attrs: `data-wc-tip="${esc(cardTip(card))}"`})).join("")}</div>
                ${done ? "" : `<div class="witch-cauldron-actions"><button type="button" data-wc-add="keep">加入自己的坩埚</button><button type="button" data-wc-add="drop">弃掉这张牌</button></div>`}`;
        }
        if (view.stage === "swap") {
            const done = view.pending_swap !== undefined && view.pending_swap !== null ? true : view.players.find(p => p.player_id === view.you)?.submitted;
            const others = view.players.filter(player => player.alive && player.player_id !== view.you);
            return `<div class="witch-cauldron-tray-head" data-wc-explain="${esc(EXPLANATIONS.swap)}">${done ? "已经提交，等待其他女巫" : "想和谁交换整锅坩埚？双方都提出才会成交"}</div>
                ${done ? "" : `<div class="witch-cauldron-actions witch-cauldron-swaps">${others.map(player => `<button type="button" class="witch-cauldron-chip${proposedSwap === player.player_id ? " is-on" : ""}" data-wc-swap="${esc(player.player_id)}">${esc(player.name)}</button>`).join("")}</div><div class="witch-cauldron-actions"><button type="button" data-wc-swap="">不交换</button></div>`}`;
        }
        if (view.stage === "drink") {
            const done = view.pending_drink !== null && view.pending_drink !== undefined;
            const forced = me()?.cauldron.some(entry => entry.card?.id === "oath");
            const used = me()?.refused;
            return `<div class="witch-cauldron-tray-head" data-wc-explain="${esc(EXPLANATIONS.drink)}">${done ? "已经宣布，等待其他女巫" : forced ? "真名血契让你必须喝下这锅秘药" : "喝下这锅秘药，还是拒绝？"}</div>
                ${done ? "" : `<div class="witch-cauldron-actions"><button type="button" data-wc-drink="yes">喝下</button><button type="button" data-wc-drink="no" ${forced || used ? "disabled" : ""}>拒绝饮用${used ? "（已用过）" : ""}</button></div>`}`;
        }
        if (view.stage === "chameleon") {
            const mine = legal("chameleon");
            return `<div class="witch-cauldron-tray-head" data-wc-explain="${esc(EXPLANATIONS.chameleon)}">${mine ? "变色龙尾巴：选择让哪一种颜色减 1" : "等待其他女巫使用变色龙尾巴"}</div>
                ${mine ? '<div class="witch-cauldron-actions"><button type="button" data-wc-cham="red">🔴 红色值 −1</button><button type="button" data-wc-cham="blue">🔵 蓝色值 −1</button></div>' : ""}`;
        }
        if (view.stage === "scoring") {
            const ready = view.next_ready.includes(view.you);
            return `<div class="witch-cauldron-tray-head">本轮结算</div>
                <div class="witch-cauldron-summary">${view.round_summary.map(row => {
                    const out = OUTCOME[row.outcome] || {icon: "❔", zh: row.outcome};
                    return `<div class="witch-cauldron-summary-row${row.player_id === view.you ? " is-me" : ""}"><span class="witch-cauldron-summary-name">${esc(nameOf(row.player_id))}</span><span class="witch-cauldron-summary-out">${out.icon} ${out.zh}</span><span class="witch-cauldron-summary-diff">🔴 ${row.red} · 🔵 ${row.blue} · 差 ${row.diff}</span><span class="witch-cauldron-summary-pts">+${row.points}</span></div>`;
                }).join("")}</div>
                <div class="witch-cauldron-actions"><button type="button" data-wc-next="1" data-wc-explain="${esc(EXPLANATIONS.next)}" ${ready ? "disabled" : ""}>${ready ? "等待其他女巫" : "Next Round"}</button></div>`;
        }
        if (view.stage === "game_over") {
            const winners = view.winner.map(nameOf).join("、") || "无人获胜";
            return `<div class="witch-cauldron-tray-head">游戏结束</div>
                <div class="witch-cauldron-summary">${view.players.slice().sort((a, b) => b.total - a.total).map(player => `<div class="witch-cauldron-summary-row${view.winner.includes(player.player_id) ? " is-me" : ""}"><span class="witch-cauldron-summary-name">${esc(player.name)}</span><span class="witch-cauldron-summary-out">${player.alive ? "存活" : "出局"}</span><span class="witch-cauldron-summary-diff">💥 ${player.explosions} · ☠️ ${player.poisons}</span><span class="witch-cauldron-summary-pts">🏆 ${player.total}</span></div>`).join("")}</div>
                <div class="witch-cauldron-tray-head">胜者：${esc(winners)}</div>`;
        }
        return "";
    }

    function render() {
        if (!view) { panel.innerHTML = ""; return; }
        view.forceReveal = !!view.hand.find(card => cardKey(card) === selectedCard)?.must_reveal;
        panel.innerHTML = `<div class="witch-cauldron-root">
            <div class="witch-cauldron-status" data-wc-explain="${esc(EXPLANATIONS.status)}"><span>${esc(stageLine())}</span><span class="witch-cauldron-goal">目标 🏆 ${view.target} · 安全差值 ≤ ${view.safe_diff}</span></div>
            <div class="witch-cauldron-board">${view.players.map(cauldronHTML).join("")}</div>
            <div class="witch-cauldron-tray">${trayHTML()}</div>
        </div>`;
    }

    function hideTip() {
        tip.hidden = true;
        window.clearTimeout(tipTimer);
    }

    function showTip(text, anchor, touch) {
        if (!text || explaining) return;
        window.clearTimeout(tipTimer);
        tip.textContent = text;
        tip.hidden = false;
        const rect = anchor.getBoundingClientRect();
        const bounds = tip.getBoundingClientRect();
        const x = touch ? (window.innerWidth - bounds.width) / 2 : rect.left;
        const y = rect.top > bounds.height + 16 ? rect.top - bounds.height - 8 : rect.bottom + 8;
        tip.style.left = `${Math.max(12, Math.min(window.innerWidth - bounds.width - 12, x))}px`;
        tip.style.top = `${Math.max(12, Math.min(window.innerHeight - bounds.height - 12, y))}px`;
        if (touch) tipTimer = window.setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        panel.classList.toggle("is-explaining", enabled);
        explainButton.setAttribute("aria-pressed", String(enabled));
        hideTip();
    }

    function openDialog(title, html) {
        hideTip();
        returnFocus = document.activeElement;
        dialogTitle.textContent = title;
        dialogBody.innerHTML = html;
        if (!dialog.open) dialog.showModal();
        dialogClose.focus();
    }

    function showHelp() {
        setExplain(false);
        const pack = HELP[helpLang];
        const sections = [pack.basic, pack.flow, pack.score, pack.cards, pack.online];
        dialogLang.textContent = helpLang === "zh" ? "EN" : "中文";
        openDialog(pack.title, sections[helpTab]);
        dialogTabs.innerHTML = pack.tabs.map((label, index) => `<button type="button" class="witch-cauldron-tab${index === helpTab ? " is-on" : ""}" data-wc-tab="${index}">${esc(label)}</button>`).join("");
    }

    function showExplanation(target) {
        const text = target.getAttribute("data-wc-explain");
        if (!text) return;
        openDialog("Explain", `<p>${esc(text)}</p>`);
        // task40: clicking an explained control leaves Explain mode by itself.
        setExplain(false);
    }

    function isExplainExempt(node) {
        return !node || node === helpButton || node === explainButton || dialog.contains(node);
    }

    function send(action) {
        if (pending) return;
        pending = true;
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; render(); }, 8000);
        if (typeof sendAction === "function") sendAction(action);
        selectedCard = null;
        selectedTarget = null;
        render();
    }

    function cancelSelection() {
        if (!selectedCard && !selectedTarget && !proposedSwap) return;
        selectedCard = null;
        selectedTarget = null;
        proposedSwap = null;
        render();
    }

    panel.addEventListener("click", event => {
        if (explaining) return;
        const card = event.target.closest("[data-wc-card]");
        if (card && legal("setup_pick")) { selectedCard = card.getAttribute("data-wc-card"); render(); return; }
        if (card && legal("play_card")) { selectedCard = card.getAttribute("data-wc-card"); selectedTarget = null; render(); return; }
        const draft = event.target.closest("[data-wc-draft]");
        if (draft && legal("draft_pick")) { send({type: "draft_pick", round: view.round, card_id: draft.getAttribute("data-wc-draft")}); return; }
        // The confirmation mask lives inside the cauldron, so it must be tested first.
        const play = event.target.closest("[data-wc-play]");
        if (play && selectedCard && selectedTarget && legal("play_card")) {
            send({type: "play_card", round: view.round, card_id: selectedCard, target: selectedTarget,
                  face_up: play.getAttribute("data-wc-play") === "up", peek: null});
            return;
        }
        const pot = event.target.closest("[data-wc-pot]");
        if (pot && selectedCard && legal("play_card")) {
            const id = pot.getAttribute("data-wc-pot");
            const player = playerById(id);
            if (player && player.alive && !player.sealed) { selectedTarget = id; render(); }
            return;
        }
        if (event.target.closest("[data-wc-setup]") && selectedCard && legal("setup_pick")) {
            send({type: "setup_pick", round: view.round, card_id: selectedCard});
            return;
        }
        const add = event.target.closest("[data-wc-add]");
        if (add && legal("add_card")) {
            const keep = add.getAttribute("data-wc-add") === "keep";
            send({type: "add_card", round: view.round, card_id: keep ? (view.hand[0] ? cardKey(view.hand[0]) : null) : null});
            return;
        }
        const swap = event.target.closest("[data-wc-swap]");
        if (swap && legal("swap")) {
            const partner = swap.getAttribute("data-wc-swap") || null;
            send({type: "swap", round: view.round, partner});
            return;
        }
        const drink = event.target.closest("[data-wc-drink]");
        if (drink && legal("drink")) {
            send({type: "drink", round: view.round, drink: drink.getAttribute("data-wc-drink") === "yes"});
            return;
        }
        const cham = event.target.closest("[data-wc-cham]");
        if (cham && legal("chameleon")) {
            send({type: "chameleon", round: view.round, color: cham.getAttribute("data-wc-cham")});
            return;
        }
        const next = event.target.closest("[data-wc-next]");
        if (next && legal("next_round")) { send({type: "next_round", round: view.round}); return; }
        if (!event.target.closest(".witch-cauldron-card, .witch-cauldron-pot, .witch-cauldron-actions, button")) cancelSelection();
    });

    panel.addEventListener("pointerdown", event => {
        lastPointerType = event.pointerType || "mouse";
        const anchor = event.target.closest("[data-wc-tip]");
        if (anchor && lastPointerType !== "mouse") showTip(anchor.getAttribute("data-wc-tip"), anchor, true);
    }, true);
    panel.addEventListener("pointerover", event => {
        if (lastPointerType !== "mouse") return;
        const anchor = event.target.closest("[data-wc-tip]");
        if (anchor) showTip(anchor.getAttribute("data-wc-tip"), anchor, false);
    });
    panel.addEventListener("pointerout", event => {
        if (lastPointerType === "mouse" && event.target.closest("[data-wc-tip]")) hideTip();
    });

    document.addEventListener("click", event => {
        if (!explaining || !view || isExplainExempt(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = event.target.closest("[data-wc-explain]");
        if (target) showExplanation(target);
    }, true);
    document.addEventListener("keydown", event => {
        if (!view) return;
        if (event.key === "Escape") {
            hideTip();
            if (dialog.open) return;                 // the native dialog closes itself
            if (explaining) { event.preventDefault(); setExplain(false); }
            else cancelSelection();
        }
    }, true);

    dialogTabs.addEventListener("click", event => {
        const tab = event.target.closest("[data-wc-tab]");
        if (!tab) return;
        helpTab = Number(tab.getAttribute("data-wc-tab"));
        showHelp();
    });
    dialogLang.addEventListener("click", () => {
        helpLang = helpLang === "zh" ? "en" : "zh";
        showHelp();
    });
    helpButton.addEventListener("click", showHelp);
    explainButton.addEventListener("click", () => setExplain(!explaining));
    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => { hideTip(); if (returnFocus?.isConnected) returnFocus.focus(); });
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    document.addEventListener("scroll", hideTip, true);

    function clearState() {
        view = null;
        selectedCard = null;
        selectedTarget = null;
        proposedSwap = null;
        pending = false;
        signature = null;
        window.clearTimeout(pendingTimer);
        setExplain(false);
        hideTip();
        if (dialog.open) dialog.close();
        panel.innerHTML = "";
    }

    window.renderWitchCauldronGameState = data => {
        const next = data?.view || data;
        if (!next?.players || next.game_id !== "witch_cauldron") return;
        const nextSignature = JSON.stringify([data?.room_id, next.round, next.circle, next.stage, next.current_player]);
        if (nextSignature !== signature) {
            selectedCard = null;
            selectedTarget = null;
            proposedSwap = null;
            hideTip();
            pending = false;
            window.clearTimeout(pendingTimer);
        }
        signature = nextSignature;
        view = next;
        render();
    };
    window.showWitchCauldronHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clearState();
    };
    window.clearWitchCauldronState = clearState;

    function connectEvents() {
        if (typeof socket === "undefined") return;
        socket.on("system:error", () => {
            if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); }
        });
        if (typeof currentRoomState !== "undefined" && currentRoomState) {
            window.renderWitchCauldronGameState(currentRoomState);
        }
    }
    if (document.readyState === "loading" || typeof socket === "undefined") {
        window.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    } else {
        connectEvents();
    }
})();
