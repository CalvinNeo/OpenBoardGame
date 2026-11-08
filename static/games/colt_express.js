(() => {
    "use strict";

    const panel = document.getElementById("coltExpressPanel");
    const surface = document.getElementById("coltExpressSurface");
    const header = document.getElementById("coltExpressHeaderActions");
    const helpButton = document.getElementById("coltExpressHelpBtn");
    const explainButton = document.getElementById("coltExpressExplainBtn");
    const dialog = document.getElementById("coltExpressDialog");
    const tooltip = document.getElementById("coltExpressTooltip");
    let view = null, signature = null, selection = null, busy = false;
    let suppressUntil = 0, busyTimer = null, tipTimer = null, returnFocus = null;

    const COLT_EXPRESS_EXPLAIN = {
        edition: {
            zh: "柯尔特快车（Colt Express）基础版标准 3–6 人。每人控制一名匪徒，进行五轮抢劫。本实现不含扩展、专家弃牌模式和双人双角色变体，列车与卡牌使用原创界面。",
            en: "Colt Express base game for three to six players. Each of you runs one bandit through five rounds of robbery. This build ships no expansions, no expert discard mode and no two player double role variant, and the train and cards use original artwork."
        },
        program: {
            zh: "策划（🎴）：依当前回合规则，每次打出一张行动牌，或者抽三张牌。所有人的行动会按顺序进入公共队列，策划结束后再依次执行。手中的子弹（🔫）不能打出。",
            en: "Programming (🎴): depending on the round card you either play one action card or draw three cards. Everybody's actions join a shared queue in order and resolve only after programming ends. Bullet cards (🔫) in hand can never be played."
        },
        execute: {
            zh: "执行（▶）：按行动队列逐张执行。行动者依据此时棋盘选择合法目标，确认后所有人立即看到结果。无法完成的行动需要确认落空，有合法目标时必须执行。",
            en: "Resolving (▶): the queue resolves one card at a time. The acting player picks a legal target from the board as it stands at that moment and everyone sees the result at once. An action with no legal target must be confirmed as a fizzle, and one with a legal target must be carried out."
        },
        normal: {
            zh: "公开回合（☀️）：依次打出一张面朝上的行动牌，或者抽三张牌。",
            en: "Normal round (☀️): everyone plays one action card face up in turn, or draws three cards."
        },
        tunnel: {
            zh: "隧道回合（🌑）：打出的行动牌面朝下，所有人只能看到牌背，执行时才公开，请记住自己的行动。抽牌仍然公开。",
            en: "Tunnel round (🌑): action cards are played face down so everyone sees only the card back until it resolves, so remember what you played. Drawing cards still happens in the open."
        },
        double: {
            zh: "双行动回合（✌️）：每人连续进行两次策划，每次分别选择打牌或抽三张牌。",
            en: "Double action round (✌️): everyone programmes twice in a row, choosing between playing a card and drawing three cards each time."
        },
        reverse: {
            zh: "逆序回合（↶）：以相反的座位顺序轮流策划，已经放入行动队列的牌不会倒序。",
            en: "Reverse round (↶): programming runs in the opposite seat order, while cards already in the queue keep their original order."
        },
        move: {
            zh: "移动（👣）：车内移动到相邻一节，车顶可移动一至三节。行动实际执行时才决定方向和距离，车头编号为 0，数字越大越靠近车尾。",
            en: "Move (👣): inside the train you shift one car, on the roof you may move one to three cars. Direction and distance are chosen only when the action resolves, car 0 is the locomotive and higher numbers sit closer to the rear."
        },
        climb: {
            zh: "攀爬（🪜）：在所在车厢的车顶与车内之间切换。进入有警长（⭐）的车内会收到一张中立子弹（🔫）并逃上车顶。",
            en: "Climb (🪜): switch between the roof and the inside of the car you occupy. Climbing into a car holding the marshal (⭐) earns you a neutral bullet (🔫) and sends you back up to the roof."
        },
        rob: {
            zh: "抢劫（💰）：拿取自己所在车厢、所在层的一件战利品。钱袋（💰）金额只对持有人可见，宝石（💎）值 $500，保险箱（🧳）值 $1,000。",
            en: "Rob (💰): take one piece of loot from the car and level you occupy. Only the holder sees the value of a purse (💰), while a gem (💎) is worth $500 and a strongbox (🧳) is worth $1,000."
        },
        shoot: {
            zh: "射击（🔫）：车内射击相邻车厢内的人，车顶射击每个方向最近有人车厢上的目标。对手收到一张你的子弹，以后的手牌会被它占据。每名匪徒共六发，已射出子弹最多者在终局获得 $1,000 神枪手奖励。",
            en: "Shoot (🔫): from inside you hit an adjacent car, from the roof you hit the nearest occupied car in each direction. The target takes one of your bullets, which then clutters their later hands. Every bandit has six bullets and whoever fired the most collects the $1,000 sharpshooter bonus at the end."
        },
        punch: {
            zh: "拳击（👊）：攻击同一车厢、同一层的另一名匪徒，选择其掉落的战利品类型，再将其击退到相邻车厢的同一层。对手没有战利品时仍可拳击。钱袋（💰）掉落前无法挑选金额。",
            en: "Punch (👊): hit another bandit in the same car and on the same level, choose which type of loot they drop, then push them into an adjacent car on the same level. You may punch a bandit carrying nothing at all, and you cannot pick the value of a dropped purse (💰)."
        },
        marshal: {
            zh: "警长（⭐）：沿车内移动警长一节。每位与警长处于同车厢车内的匪徒都会收到一张中立子弹（🔫）并逃上车顶。中立子弹共十三张，若不足以同时分给本批所有目标，整批都不发子弹，匪徒仍会逃上车顶。",
            en: "Marshal (⭐): move the marshal one car along the inside of the train. Every bandit sharing that car with him takes a neutral bullet (🔫) and flees to the roof. There are thirteen neutral bullets, and if there are not enough for the whole group nobody receives one, although everybody still flees to the roof."
        },
        bullet: {
            zh: "子弹（🔫）：收到的子弹混入以后每轮的牌库，占据手牌位置且不能作为行动打出。角色板的 🔫 数字是剩余弹药，🩹 数字是累计收到的子弹。",
            en: "Bullets (🔫): bullets you receive are shuffled into your deck for later rounds, where they occupy a hand slot and can never be played as an action. The 🔫 figure on a role board is remaining ammo and the 🩹 figure is the total bullets taken."
        },
        draw: {
            zh: "抽牌（🃏）：消耗一次策划，抽三张牌。牌库不足三张时抽取剩余牌。这会增加之后可选择的行动，也可能抽到子弹（🔫）。",
            en: "Draw (🃏): spend one programming step to draw three cards, or whatever is left when the deck holds fewer. This widens your later choices and may also hand you bullets (🔫)."
        },
        fizzle: {
            zh: "确认落空：当前行动已没有合法目标或弹药。点击后记录这次落空，再执行队列中的下一张牌。",
            en: "Confirm fizzle: the current action has run out of legal targets or ammo. Pressing it records the fizzle and moves on to the next card in the queue."
        },
        event_loot: {
            zh: "扒窃（💰）：终点事件时，独处于一节车厢某一层的匪徒可以选择当地一个钱袋。钱袋金额保持隐藏，点选后在原位置 Confirm，也可以放弃本次扒窃。",
            en: "Pickpocket (💰): during the end event a bandit alone on one level of a car may claim a purse there. Its value stays hidden, you Confirm in place after choosing, and you may also skip the pickpocket."
        },
        skip_event: {
            zh: "放弃扒窃：不拿取本次终点事件的钱袋，继续下一位匪徒的事件选择。全部事件选择完成后，进入轮末回顾。",
            en: "Skip pickpocket: take no purse from this end event and pass the choice to the next bandit. Once every choice is in, the round review begins."
        },
        review: {
            zh: "轮末回顾（📜）：事件已经结算，棋盘保留结算后的位置。记录中与你有关的条目以金色标记，所有玩家都点击 Next Round 后才继续。最后一轮也先回顾，再显示总榜。",
            en: "Round review (📜): the event is settled and the board keeps the resulting positions. Entries about you are marked in gold, and play continues only once every player has pressed Next Round. The final round is reviewed first and only then shows the standings."
        },
        train: {
            zh: "列车（🚂）：0 号是车头，其后依数字顺序连接至车尾。每节分车顶（深蓝）与车内（木色），同一车厢的不同层不视为同一位置。移动与射击的合法目标以当前执行时的位置为准。",
            en: "Train (🚂): car 0 is the locomotive and the rest follow in order to the rear. Every car has a roof in dark blue and an interior in wood, and the two levels of one car count as different places. Legal move and shoot targets are judged from the positions at the moment the action resolves."
        },
        queue: {
            zh: "行动队列（🎴）：编号是执行顺序。深色标记当前行动，淡色代表已经完成。隧道与 Ghost 能力隐藏的牌对所有人都只显示背面，执行时才公开，请记住自己的行动。",
            en: "Action queue (🎴): the numbers give the resolution order. The dark entry is the current action and faded ones are already done. Cards hidden by a tunnel round or by Ghost show only their back to everyone until they resolve, so remember what you played."
        },
        loot: {
            zh: "战利品：钱袋（💰）金额只有持有人知道，宝石（💎）$500，保险箱（🧳）$1,000。其他匪徒面板只显示件数。# 编号用于辨认同一件战利品，不暗示金额。最终以战利品总额加神枪手奖金计分。",
            en: "Loot: only the holder knows the value of a purse (💰), while a gem (💎) is $500 and a strongbox (🧳) is $1,000. Other bandits' panels show counts only. The # number identifies a piece of loot and says nothing about its value, and scoring adds up the loot plus the sharpshooter bonus."
        },
        ammo: {
            zh: "弹药（🔫）：每人六发。射击成功将自己的子弹牌交给目标，无弹药时不能射击。神枪手（🎯）按实际射出子弹数评比，并列最多者各得 $1,000。",
            en: "Ammo (🔫): six bullets each. A successful shot hands your bullet card to the target, and you cannot shoot without ammo. The sharpshooter (🎯) award goes to whoever actually fired the most bullets, and ties each collect $1,000."
        },
        deck: {
            zh: "牌库（🃏）和手牌（🎴）：每轮将十张行动牌和收到的子弹混洗，通常抽六张手牌，Doc 抽七张。对手只能看到张数。",
            en: "Deck (🃏) and hand (🎴): each round the ten action cards are shuffled together with any bullets you received, and you normally draw six cards while Doc draws seven. Opponents see only the count."
        },
        score: {
            zh: "最终计分（🏆）：战利品金额加神枪手（🎯）奖励。总金额相同时，收到子弹较少者优先，仍相同则共享胜利。",
            en: "Final scoring (🏆): loot value plus the sharpshooter (🎯) bonus. Ties are broken in favour of whoever took fewer bullets, and a remaining tie is a shared victory."
        },
        role_ghost: {
            zh: "Ghost（👻）：每轮第一个个人策划机会可以将行动牌隐藏。若这次选择抽牌，本轮就失去这次能力。其他人只看到牌背，直到执行时才揭示。",
            en: "Ghost (👻): on your first personal programming step each round you may hide the action card you play. Choosing to draw instead costs you that ability for the round. Others see only the card back until it resolves."
        },
        role_doc: {
            zh: "Doc（🎩）：每轮开始时抽七张牌，比其他人多一张。",
            en: "Doc (🎩): draws seven cards at the start of every round, one more than everyone else."
        },
        role_tuco: {
            zh: "Tuco（🤠）：除正常射击范围外，也能射击同车厢另一层的匪徒。",
            en: "Tuco (🤠): besides the normal range, he may also shoot a bandit on the other level of his own car."
        },
        role_cheyenne: {
            zh: "Cheyenne（🦊）：拳击使对方掉落钱袋（💰）时，可以直接拿走这个钱袋，或者将它留在原位置。宝石（💎）和保险箱（🧳）仍留在原位置。",
            en: "Cheyenne (🦊): when a punch makes the target drop a purse (💰) she may take that purse outright or leave it where it fell. Gems (💎) and strongboxes (🧳) always stay in place."
        },
        role_belle: {
            zh: "Belle（🌹）：当射击或拳击还有其他合法目标可选时，不能选择她为目标。只有她是唯一可选目标时，仍可被攻击。",
            en: "Belle (🌹): she cannot be chosen for a shoot or punch while any other legal target exists. She can still be attacked when she is the only target available."
        },
        role_django: {
            zh: "Django（🧨）：射击命中后将目标再向远离自己的一侧击退一节，同层不变，列车边缘不能再击退。",
            en: "Django (🧨): after a hit he pushes the target one further car away from himself on the same level, and nothing is pushed past the end of the train."
        },
        dialog_close: {
            zh: "关闭当前对话框并回到牌桌。",
            en: "Close the current dialog and return to the table."
        }
    };
    const zhText = key => COLT_EXPRESS_EXPLAIN[key]?.zh || COLT_EXPRESS_EXPLAIN.program.zh;
    const kindIcons = {move:"👣", climb:"🪜", rob:"💰", shoot:"🔫", punch:"👊", marshal:"⭐", draw:"🃏", fizzle:"💨", bullet:"🔫", event_loot:"💰", skip_event:"↪"};
    const kindNames = {move:"移动", climb:"攀爬", rob:"抢劫", shoot:"射击", punch:"拳击", marshal:"警长", draw:"抽三张牌", fizzle:"确认落空", bullet:"子弹", event_loot:"扒窃钱袋", skip_event:"放弃扒窃"};
    const phaseNames = {program:"策划行动", execute:"执行行动", event:"终点事件", round_end:"轮末回顾", game_over:"列车抵达 · 最终结算"};
    const turnNames = {normal:"☀️ 公开", tunnel:"🌑 隧道", double:"✌️ 双行动", reverse:"↶ 逆序"};
    const roleColors = {ghost:"#dce5ed",doc:"#64b8df",tuco:"#d75b5d",cheyenne:"#63b184",belle:"#b27bd1",django:"#343434"};
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const players = () => view?.players || [];
    const actions = () => view?.legal_actions || [];
    const person = id => players().find(p => p.player_id === id);
    const playerName = id => person(id)?.name || id || "—";
    const mine = () => person(view?.you);
    const connected = () => typeof socket !== "undefined" && socket.connected;
    const roleKey = p => String(p?.role || "").toLowerCase();
    const roleColor = p => /^#[0-9a-f]{6}$/i.test(p?.color || "") ? p.color : roleColors[roleKey(p)] || "#8a7755";
    const signed = n => `${Number(n) > 0 ? "+" : ""}${n ?? 0}`;
    function explanation(key) {
        if (key === "event") return `${view?.round_card?.event_name || "轮末事件"}：${view?.round_card?.event_description || "本轮执行结束后结算事件。"}`;
        return zhText(key);
    }
    function info(label, key, custom) {
        return `<span tabindex="0" data-ce-explain="${esc(key)}" data-ce-tip="${esc(custom || explanation(key))}">${esc(label)}</span>`;
    }
    function openDialog(title, body) {
        hideTip(); returnFocus = document.activeElement;
        document.getElementById("coltExpressDialogTitle").textContent = title;
        document.getElementById("coltExpressDialogBody").innerHTML = body;
        if (!dialog.open) dialog.showModal();
    }
    const enText = key => COLT_EXPRESS_EXPLAIN[key]?.en || COLT_EXPRESS_EXPLAIN.program.en;
    const ceParas = (keys, lang) => keys.map(key => `<p>${esc(lang === "en" ? enText(key) : zhText(key))}</p>`).join("");
    const COLT_EXPRESS_HELP_CONFIG = {
        gameId: "colt_express",
        title: { zh: "柯尔特快车 · Colt Express", en: "Colt Express" },
        basic: {
            win: {
                zh: "五轮抢劫结束后，战利品总额加神枪手(🎯)奖金最高的匪徒获胜。",
                en: "After five rounds of robbery the bandit holding the highest loot total plus the sharpshooter (🎯) bonus wins the game."
            },
            turn: {
                zh: "每轮先按回合卡(☀️)轮流策划，每次打出一张行动牌或者抽三张牌(🃏)，全部策划完再依队列逐张执行(▶)。",
                en: "Each round everyone programmes in turn under the round card (☀️), either playing one action card or drawing three cards (🃏), and the whole queue resolves one card at a time (▶) only after that."
            },
            key: {
                zh: "策划时你并不知道别人会做什么，所以真正的功夫在于预判行动顺序、卡住警长(⭐)的位置，并把子弹(🔫)留给真正值得的目标。",
                en: "You programme without knowing what anyone else will do, so the real skill lies in reading the coming order of actions, using the position of the marshal (⭐), and saving your bullets (🔫) for targets that are actually worth them."
            }
        },
        sections: [
            {
                id: "flow",
                label: { zh: "一趟快车，五轮抢劫", en: "Five rounds on one train" },
                html: {
                    zh: "<p>每轮抽牌后，按照回合卡(☀️)轮流打出行动牌，或者抽三张牌(🃏)，先谋划后行动。</p><p>策划结束后依队列逐张执行，执行者到这一刻才选目的地、射击对象、战利品或者拳击目标。</p><p>全部行动执行后结算轮末事件(📜)，每人查看回顾并点击 Next Round 才能继续。</p><p>第五轮完成后统计战利品与神枪手(🎯)奖金，最富有的匪徒获胜。</p>" + ceParas(["edition"], "zh"),
                    en: "<p>Once the round's cards are drawn, everyone programmes in turn under the round card (☀️), playing an action card or drawing three cards (🃏), and everything is planned before anything actually happens.</p><p>The queue then resolves one card at a time, and only at that moment does the acting player choose a destination, a shooting target, a piece of loot or a punch target.</p><p>After every action has resolved the round event (📜) is settled, and each player reviews it and presses Next Round before play continues.</p><p>When the fifth round is over the loot and the sharpshooter (🎯) bonus are tallied and the richest bandit wins.</p>" + ceParas(["edition"], "en")
                }
            },
            {
                id: "train",
                label: { zh: "列车与战利品", en: "Train and loot" },
                html: {
                    zh: "<p>警长(⭐)从车头出发，匪徒交替从末节与倒数第二节车内出发。每人初始持有一个 $250 钱袋(💰)、十张行动牌和六发弹药(🔫)。</p><p>钱袋配比是本实现的线上配置，$250 共八个，$300、$350、$400、$450、$500 各两个，先取出各玩家的初始钱袋。官方说明列出十八个钱袋及金额范围，未列逐面额数量，本次未能逐枚核对。</p>" + ceParas(["train", "loot"], "zh"),
                    en: "<p>The marshal (⭐) starts in the locomotive while the bandits start in alternating order inside the last and second to last cars. Everyone begins with one $250 purse (💰), ten action cards and six bullets (🔫).</p><p>The purse mix is this build's online configuration, eight copies of $250 and two each of $300, $350, $400, $450 and $500, after the players' starting purses are taken out. The official rules list eighteen purses and their value range without per denomination counts, so that part was not verified piece by piece.</p>" + ceParas(["train", "loot"], "en")
                }
            },
            {
                id: "program",
                label: { zh: "策划与执行", en: "Programming and resolving" },
                html: {
                    zh: ceParas(["program", "normal", "tunnel", "double", "reverse", "draw", "bullet", "execute", "queue", "deck"], "zh"),
                    en: ceParas(["program", "normal", "tunnel", "double", "reverse", "draw", "bullet", "execute", "queue", "deck"], "en")
                }
            },
            {
                id: "actions",
                label: { zh: "六种行动", en: "The six actions" },
                html: {
                    zh: ceParas(["move", "climb", "rob", "shoot", "punch", "marshal", "fizzle"], "zh"),
                    en: ceParas(["move", "climb", "rob", "shoot", "punch", "marshal", "fizzle"], "en")
                }
            },
            {
                id: "roles",
                label: { zh: "六位匪徒", en: "The six bandits" },
                html: {
                    zh: ceParas(["role_ghost", "role_doc", "role_tuco", "role_cheyenne", "role_belle", "role_django"], "zh"),
                    en: ceParas(["role_ghost", "role_doc", "role_tuco", "role_cheyenne", "role_belle", "role_django"], "en")
                }
            },
            {
                id: "ending",
                label: { zh: "回顾与胜利", en: "Review and victory" },
                html: {
                    zh: ceParas(["event_loot", "skip_event", "review", "ammo", "score"], "zh"),
                    en: ceParas(["event_loot", "skip_event", "review", "ammo", "score"], "en")
                }
            },
            {
                id: "controls",
                label: { zh: "操作", en: "Controls" },
                html: {
                    zh: "<p>点选手牌或目标后，在原位置点击 Confirm，点击周围空白或按 Esc 取消。Next Round 直接确认回顾，不会重复弹窗。</p><p>Explain 之后点选任意对象即可查看它的规则，看完会自动退出，灰色按钮同样可以解释。</p><p>图标与指标支持鼠标悬停，手机轻点会显示三秒提示。</p>",
                    en: "<p>After selecting a card or a target, press Confirm in place, and tap the empty area around it or press Esc to cancel. Next Round confirms the review directly without opening a second dialog.</p><p>In Explain mode you tap any object to read its rule, the mode exits on its own afterwards, and greyed out buttons can be explained as well.</p><p>Icons and figures can be hovered with a mouse, and a tap on a phone shows a three second tip.</p>"
                }
            }
        ]
    };

    let coltExpressHelpWidget = null;
    let coltExpressExplainWidget = null;

    function initColtExpressHelpExplain() {
        if (coltExpressHelpWidget || typeof window.obgCreateHelp !== "function") return;
        coltExpressHelpWidget = window.obgCreateHelp(COLT_EXPRESS_HELP_CONFIG);
        coltExpressExplainWidget = window.obgCreateExplain({
            gameId: "colt_express",
            attribute: "data-ce-explain",
            explanations: COLT_EXPRESS_EXPLAIN,
            button: explainButton,
            root: () => panel,
            bypass: ["#coltExpressHelpBtn", "#coltExpressExplainBtn", "#coltExpressDialog"]
        });
        helpButton?.addEventListener("click", () => {
            coltExpressExplainWidget?.exit();
            coltExpressHelpWidget.open();
        });
        explainButton?.addEventListener("click", () => coltExpressExplainWidget?.toggle());
    }
    function hideTip() { tooltip.hidden = true; clearTimeout(tipTimer); }
    function showTip(el) {
        if (!el?.dataset.ceTip || coltExpressExplainWidget?.isActive() || dialog.open) return;
        clearTimeout(tipTimer); tooltip.textContent = el.dataset.ceTip; tooltip.hidden = false;
        const rect = el.getBoundingClientRect(), tip = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(innerWidth - tip.width - 12, rect.left))}px`;
        tooltip.style.top = `${Math.max(12, Math.min(innerHeight - tip.height - 12, rect.bottom + 7))}px`;
        tipTimer = setTimeout(hideTip, 3000);
    }
    function confirmOverlay(index, key) {
        const action = actions()[index];
        const variants = action?.type === "play" ? actions().map((a,i)=>({a,i})).filter(({a})=>a.type === "play" && a.card_id === action.card_id) : [];
        const choice = variants.length > 1 ? `<select class="ce-visibility" aria-label="行动牌公开方式" data-ce-visibility data-ce-explain="role_ghost">${variants.map(({a,i})=>`<option value="${i}" ${i === index ? "selected" : ""}>${a.hidden ? "暗置" : "公开"}</option>`).join("")}</select>` : `<small>${action?.type === "play" && action.hidden ? "🎴 暗置行动" : "确认这个选择？"}</small>`;
        return `<div class="ce-action-overlay">${choice}<div class="ce-confirm-buttons"><button type="button" class="ce-primary" data-ce-confirm="${index}" data-ce-explain="${esc(key)}" ${busy || !connected() ? "disabled" : ""}>Confirm</button><button type="button" data-ce-cancel data-ce-explain="${esc(key)}">Cancel</button></div></div>`;
    }
    function actionCard(action, index, anchor, content, key, cls) {
        const selected = selection?.anchor === anchor;
        return `<div class="ce-action-wrap"><button type="button" class="${cls}" data-ce-action="${index}" data-ce-anchor="${esc(anchor)}" data-ce-explain="${esc(key)}" aria-pressed="${selected}" ${busy || !connected() ? "disabled" : ""}>${content}</button>${selected ? confirmOverlay(selection.index, key) : ""}</div>`;
    }
    function directButton(action, index, label, key, primary = false) {
        return `<button type="button" class="${primary ? "ce-primary" : ""}" data-ce-direct="${index}" data-ce-explain="${esc(key)}" ${busy || !connected() ? "disabled" : ""}>${esc(label || action.label)}</button>`;
    }
    function roundCard() {
        const card = view.round_card || {}, planning = view.phase === "program";
        return `<section class="ce-round"><div class="ce-round-title">${info(card.name || `第 ${view.round} 轮`,"program")}</div><div class="ce-round-turns">${(card.turns || []).map((kind, index)=>`<span class="ce-round-step ${planning && index === view.program_turn ? "is-current" : ""} ${!planning || index < view.program_turn ? "is-past" : ""}">${info(`${index + 1} ${turnNames[kind] || kind}`,kind)}</span>`).join("")}</div><div class="ce-round-event">${info(`📜 ${card.event_name || "轮末事件"}`,"event")}</div></section>`;
    }
    function token(player) {
        const current = player.player_id === view.current_turn;
        const label = `${player.emoji || "🤠"} ${player.name}${player.player_id === view.you ? " · You" : ""}`;
        return `<span tabindex="0" class="ce-token ${current ? "is-current" : ""} ${player.player_id === view.you ? "is-you" : ""}" style="--ce-role:${roleColor(player)}" data-ce-explain="role_${esc(roleKey(player))}" data-ce-tip="${esc(`${label} · ${player.role_name || player.role}。${explanation(`role_${roleKey(player)}`)}`)}"><span>${esc(player.emoji || "🤠")}</span><span class="ce-token-name">${esc(player.name)}</span></span>`;
    }
    function lootLine(loots) {
        if (!loots.length) return '<span class="ce-empty">—</span>';
        return ["purse", "gem", "strongbox"].map(type => {
            const group = loots.filter(l=>l.type === type);
            if (!group.length) return "";
            return info(`${{purse:"💰",gem:"💎",strongbox:"🧳"}[type]} ×${group.length}`, "loot");
        }).join("");
    }
    function board() {
        const selected = actions()[selection?.index], target = selected?.target && person(selected.target);
        return `<section class="ce-board" data-ce-explain="train"><div class="ce-board-heading"><strong>🚂 西部快车</strong>${info("车顶 / 车内 · 按编号相邻", "train")}</div><div class="ce-train">${(view.cars || []).map(car=>`<article class="ce-car"><header class="ce-car-heading"><span class="ce-car-number">${esc(car.index).padStart(2,"0")}</span><span>${car.index === 0 ? "🚂 车头" : car.index === view.cars.length - 1 ? "车尾" : "车厢"}</span></header><div class="ce-car-decks">${["roof", "inside"].map(level=>{
            const occupants = players().filter(p=>p.car === car.index && p.level === level);
            const selectedHere = target ? target.car === car.index && target.level === level : selected?.car === car.index && (selected.type === "marshal" ? level === "inside" : level === mine()?.level);
            return `<div class="ce-lane ce-lane-${level} ${selectedHere ? "is-selected" : ""}"><div class="ce-lane-label">${level === "roof" ? "车顶" : "车内"}</div><div class="ce-occupants">${occupants.map(token).join("")}${level === "inside" && view.marshal === car.index ? `<span tabindex="0" class="ce-token ce-marshal" data-ce-explain="marshal" data-ce-tip="${esc(zhText("marshal"))}">⭐ 警长</span>` : ""}</div><div class="ce-loot">${lootLine(car.loot?.[level] || [])}</div></div>`;
        }).join("")}</div></article>`).join("")}</div><div class="ce-rail" aria-hidden="true"></div><div class="ce-board-caption"><span>← 车头 · 0</span><span>车尾 · ${Math.max(0,(view.cars?.length || 1)-1)} →</span></div></section>`;
    }
    function queue() {
        const program = view.program || [];
        return `<section class="ce-box ce-queue-box"><div class="ce-row"><h3>${info(`🎴 行动队列 · ${program.length}`, "queue")}</h3></div>${program.length ? `<div class="ce-queue" data-ce-scroll="queue">${program.map(card=>`<span tabindex="0" class="ce-queue-item ${card.hidden ? "ce-hidden" : ""} is-${esc(card.status)}" data-ce-explain="queue" data-ce-tip="${esc(`${card.index + 1} · ${playerName(card.player_id)} · ${card.hidden ? "隐藏行动" : card.name}`)}"><span>${card.index + 1}</span><b>${esc(card.hidden ? "🎴" : card.emoji || kindIcons[card.kind] || "🎴")}</b><span>${esc(playerName(card.player_id))}</span></span>`).join("")}</div>` : '<p class="ce-muted">第一张行动即将入列。</p>'}</section>`;
    }
    function hand() {
        return `<div class="ce-hand">${(view.hand || []).map((card, i)=>{
            const index = actions().findIndex(action=>action.type === "play" && action.card_id === card.id);
            const key = card.bullet ? "bullet" : card.kind;
            const content = `<span class="ce-card-icon">${esc(card.emoji || kindIcons[card.kind] || "🎴")}</span><strong>${esc(card.name || kindNames[card.kind])}</strong><span class="ce-card-small">${card.bullet ? "不可打出" : "行动牌"}</span>`;
            if (index >= 0) return actionCard(actions()[index], index, `hand-${i}`, content, key, "ce-card");
            return `<div class="ce-action-wrap"><button type="button" class="ce-card ${card.bullet ? "ce-bullet" : ""}" data-ce-explain="${esc(key)}" disabled>${content}</button></div>`;
        }).join("")}</div>`;
    }
    function privateStats() {
        const player = mine();
        if (!player) return "";
        const total = player.score ?? (view.loots || []).reduce((sum, l)=>sum + (l.value || 0), 0);
        return `<div class="ce-private">${info(`🔒 资产 $${total.toLocaleString()}`, "loot")}${info(`🃏 牌库 ${player.deck_count ?? 0}`, "deck")}${info(`🔫 弹药 ${player.bullets_left ?? 0}`, "ammo")}</div><details class="ce-stash" data-ce-detail="stash"><summary>你的战利品 · ${(view.loots || []).length} 件</summary><div class="ce-stats">${(view.loots || []).map(l=>info(`${l.emoji} #${String(l.id).replace(/^loot_/, "")} · $${l.value}`, "loot", `${l.name}（${l.emoji}）：$${l.value}。钱袋金额只对你可见。`)).join("")}</div></details>`;
    }
    function actionPanel() {
        if (view.phase === "round_end" || view.phase === "game_over") return review();
        const yours = view.current_turn === view.you;
        let html = `<section class="ce-box"><h3>${view.phase === "program" ? "🎴 你的手牌" : view.phase === "event" ? "📜 终点事件" : "执行当前行动"}</h3>`;
        if (view.phase === "program") {
            html += mine() ? hand() : '<p class="ce-muted">Spectator · 手牌仅持有人可见。</p>';
            if (yours) html += `<p class="ce-muted">${esc(turnNames[view.turn_kind] || "策划")} · 还可策划 ${view.program_actions_left || 1} 次</p>`;
            html += `<div class="ce-direct">${actions().map((a,i)=>a.type === "draw" ? directButton(a,i,"🃏 抽三张牌","draw",true) : "").join("")}</div>`;
        } else {
            const card = view.active_card;
            if (card) html += `<div class="ce-active-card" data-ce-explain="${esc(card.kind || "execute")}"><span>${esc(card.emoji || kindIcons[card.kind] || "🎴")}</span><div><strong>${esc(card.name || kindNames[card.kind])}</strong><small>${esc(playerName(card.player_id))} · 队列第 ${(card.index ?? 0) + 1} 张</small></div></div>`;
            if (view.phase === "event") html += `<div class="ce-active-card" data-ce-explain="event_loot"><span>💰</span><div><strong>${esc(view.round_card?.event_name || "扒窃")}</strong><small>${esc(view.round_card?.event_description || zhText("event_loot"))}</small></div></div>`;
            const choices = actions().map((a,i)=>({a,i})).filter(({a})=>!["fizzle","next_round","draw","skip_event"].includes(a.type));
            html += `<div class="ce-options" data-ce-scroll="options">${choices.map(({a,i})=>actionCard(a,i,`option-${i}`,`<span class="ce-option-icon">${kindIcons[a.type] || "▶"}</span><strong>${esc(a.label || kindNames[a.type])}${a.loot_id ? ` · #${esc(String(a.loot_id).replace(/^loot_/, ""))}` : ""}</strong>`,a.type,"ce-option")).join("")}</div>`;
            html += `<div class="ce-direct">${actions().map((a,i)=>a.type === "fizzle" ? directButton(a,i,"确认落空 →","fizzle",true) : a.type === "skip_event" ? directButton(a,i,a.label || "放弃扒窃 →","skip_event") : "").join("")}</div>`;
        }
        if (!yours) html += `<p class="ce-muted">等待 ${esc(playerName(view.current_turn))} ${view.phase === "program" ? "策划" : "选择目标"}；行动结果会实时更新。</p>`;
        return html + privateStats() + "</section>";
    }
    function logRows(rows) {
        return (rows || []).map(row=>`<div class="ce-log-row ${(row.players || []).includes(view.you) ? "is-you" : ""}">${esc(typeof row === "string" ? row : row.text)}</div>`).join("");
    }
    function review() {
        if (view.phase === "game_over") {
            return `<section class="ce-box ce-review"><h3>🏆 最终赏金榜</h3>${(view.scoreboard || []).map((score,i)=>`<div class="ce-score ${score.winner ? "is-winner" : ""}"><div class="ce-row"><strong>${score.winner ? "🏆" : `${i + 1}.`} ${esc(score.name || playerName(score.player_id))}</strong><strong>${info(`$${Number(score.total || 0).toLocaleString()}`,"score")}</strong></div><small>${info(`💰 战利品 $${Number(score.loot_total || 0).toLocaleString()}`,"loot")} · ${info(`🎯 奖金 $${Number(score.shooter_bonus || 0).toLocaleString()}`,"ammo")} · ${info(`📜 事件 $${Number(score.event_bonus || 0).toLocaleString()}`,"event")}<br>射出 ${score.shots || 0} 发 · 收到 ${score.bullets_received || 0} 发</small></div>`).join("")}<p class="ce-muted" style="margin-top:10px">${info("五轮旅程结束，赏金已结算。","score")}</p></section>`;
        }
        const summary = view.round_summary || {}, ready = view.next_ready || [];
        const next = actions().findIndex(a=>a.type === "next_round");
        return `<section class="ce-box ce-review"><h3>📜 第 ${view.round} 轮回顾</h3><p class="ce-review-event"><strong>${esc(summary.event_name || view.round_card?.event_name)}</strong><br>${esc(summary.event_description || view.round_card?.event_description)}</p><div class="ce-review-changes">${(summary.players || []).map(p=>`<span class="ce-review-change">${esc(playerName(p.player_id))}${p.player_id === view.you ? " · You" : ""}<br>${info(`💰 ${signed(p.loot_change)}`,"loot","本轮战利品件数变化。钱袋金额仍保持私密。")} · ${info(`🩹 ${signed(p.bullets_change)}`,"bullet")} · ${info(`🎯 ${signed(p.shots_change)}`,"ammo")}</span>`).join("")}</div><div class="ce-scroll" data-ce-scroll="review">${logRows(summary.entries)}</div><div class="ce-ready">${players().map(p=>`<span class="${ready.includes(p.player_id) ? "is-ready" : ""}">${ready.includes(p.player_id) ? "✓" : "○"} ${esc(p.name)}</span>`).join("")}</div><div class="ce-direct">${next >= 0 ? directButton(actions()[next],next,"Next Round","review",true) : `<button type="button" data-ce-explain="review" disabled>${ready.includes(view.you) ? "Ready ✓" : "Waiting…"}</button>`}</div><p class="ce-muted" style="margin-top:8px">${summary.final ? "全部确认后公布最终赏金榜。" : "全部玩家确认后，开始下一轮。"}</p></section>`;
    }
    function crew() {
        return `<section class="ce-crew">${players().map(p=>`<article class="ce-player ${p.player_id === view.you ? "is-you" : ""} ${p.player_id === view.current_turn && ["program","execute","event"].includes(view.phase) ? "is-current" : ""}" style="--ce-role:${roleColor(p)}"><div class="ce-player-name"><strong>${esc(p.emoji || "🤠")} ${esc(p.name)}</strong>${p.player_id === view.you ? "<span>You</span>" : ""}</div><div class="ce-player-role">${info(p.role_name || p.role,`role_${roleKey(p)}`)}${info(`${p.car} 号 · ${p.level === "roof" ? "车顶" : "车内"}`,"train")}</div><div class="ce-stats">${info(`💰 ${p.loot_count ?? p.loots?.length ?? 0}`,"loot")}${info(`🔫 ${p.bullets_left ?? 0}`,"ammo")}${info(`🩹 ${p.bullets_received ?? 0}`,"bullet")}${info(`🎴 ${p.hand_count ?? 0}`,"deck")}</div></article>`).join("")}</section>`;
    }
    function render() {
        if (!view) return;
        const positions = {}, opened = {};
        surface.querySelectorAll("[data-ce-scroll]").forEach(el=>{positions[el.dataset.ceScroll] = el.scrollTop;});
        surface.querySelectorAll("details[data-ce-detail]").forEach(el=>{opened[el.dataset.ceDetail] = el.open;});
        const yours = actions().length > 0;
        document.body.classList.toggle("ce-needs-action", yours);
        const status = !connected() ? "Disconnected" : busy ? "Sending…" : view.phase === "round_end" ? "查看本轮结果，再一起出发" : view.phase === "game_over" ? "赏金归于赢家" : `${playerName(view.current_turn)}${view.current_turn === view.you ? " · 轮到你了" : " 正在行动"}`;
        const last = (view.log || []).at(-1);
        surface.innerHTML = `<div class="ce-status ${yours ? "is-yours" : ""}"><div class="ce-ticket" data-ce-explain="review" data-ce-tip="${esc(zhText("review"))}" tabindex="0"><span>Round</span><strong>${view.round || 1} / ${view.total_rounds || 5}</strong></div><strong>${yours ? '<span class="ce-live" aria-hidden="true"></span>' : ""}${esc(phaseNames[view.phase] || view.phase)}</strong><span class="ce-turn-copy" aria-live="polite">${esc(status)}</span></div><div class="ce-content">${roundCard()}<div class="ce-columns"><main class="ce-main">${board()}${queue()}${last ? `<div class="ce-box ce-history"><div class="ce-muted">最近行动</div>${logRows([last])}</div>` : ""}</main><aside class="ce-actions-panel">${actionPanel()}</aside></div>${crew()}<details class="ce-box ce-history" data-ce-detail="log"><summary>📖 行动记录 · ${(view.log || []).length}</summary><div class="ce-scroll" data-ce-scroll="log">${logRows(view.log)}</div></details></div>`;
        surface.querySelectorAll("[data-ce-scroll]").forEach(el=>{if (positions[el.dataset.ceScroll] != null) el.scrollTop = positions[el.dataset.ceScroll];});
        surface.querySelectorAll("details[data-ce-detail]").forEach(el=>{if (opened[el.dataset.ceDetail] != null) el.open = opened[el.dataset.ceDetail];});
    }
    function send(index) {
        const action = actions()[index];
        if (!action || busy || !connected()) return;
        busy = true; selection = null; hideTip(); render();
        sendAction({...action});
        clearTimeout(busyTimer); busyTimer = setTimeout(()=>{busy = false; render();}, 5000);
    }
    surface.addEventListener("click", event=>{
        const confirm = event.target.closest("[data-ce-confirm]");
        const direct = event.target.closest("[data-ce-direct]");
        const pick = event.target.closest("[data-ce-action]");
        if (confirm) { send(Number(confirm.dataset.ceConfirm)); return; }
        if (direct) { send(Number(direct.dataset.ceDirect)); return; }
        if (event.target.closest("[data-ce-cancel]")) { selection = null; render(); return; }
        if (pick && !busy && !pick.disabled) { selection = {index:Number(pick.dataset.ceAction), anchor:pick.dataset.ceAnchor}; hideTip(); render(); return; }
        const tip = event.target.closest("[data-ce-tip]");
        if (tip) { showTip(tip); return; }
        if (!event.target.closest("button,select,option,summary,details")) { selection = null; hideTip(); render(); }
    });
    surface.addEventListener("change", event=>{
        if (event.target.matches("[data-ce-visibility]") && selection) {
            selection.index = Number(event.target.value); render();
        }
    });
    document.addEventListener("keydown", event=>{
        if (panel.classList.contains("hidden")) return;
        if (event.key === "Escape") { coltExpressExplainWidget?.exit(); hideTip(); selection = null; if (!dialog.open) render(); }
    }, true);
    surface.addEventListener("pointerover", event=>{if (event.pointerType === "mouse") showTip(event.target.closest("[data-ce-tip]"));});
    surface.addEventListener("pointerout", event=>{if (event.pointerType === "mouse") hideTip();});
    surface.addEventListener("focusin", event=>showTip(event.target.closest("[data-ce-tip]")));
    surface.addEventListener("focusout", hideTip);
    document.getElementById("coltExpressDialogClose").addEventListener("click", ()=>dialog.close());
    dialog.addEventListener("close", ()=>{suppressUntil = 0; if (returnFocus?.isConnected) returnFocus.focus();});
    dialog.addEventListener("click", event=>{
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    document.addEventListener("scroll", hideTip, true);

    function clear() {
        view = null; signature = null; selection = null; busy = false; clearTimeout(busyTimer);
        coltExpressExplainWidget?.exit(); hideTip(); document.body.classList.remove("ce-needs-action");
        if (dialog.open) dialog.close();
        surface.innerHTML = '<div class="ce-wait">Waiting to start · 3–6 位匪徒，一趟西部快车</div>';
    }
    window.renderColtExpressGameState = data => {
        if (!data?.view || (data.game_type !== "colt_express" && data.view.game_id !== "colt_express")) return;
        if (typeof currentGameType !== "undefined" && currentGameType !== "colt_express") return;
        if (data.room_id && typeof currentRoomState !== "undefined" && currentRoomState?.room_id !== data.room_id) return;
        const next = `${data.room_id}:${data.view.game_token}:${data.view.window_id}:${data.view.you}`;
        if (next !== signature) { selection = null; hideTip(); }
        if (next !== signature || view?.revision !== data.view.revision) { busy = false; clearTimeout(busyTimer); }
        signature = next; view = data.view; render();
    };
    window.showColtExpressHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clear();
    };
    function roomSync(state) { if (state?.game_type !== "colt_express" || state.status === "lobby") clear(); }
    function sync() {
        if (typeof socket !== "undefined") {
            socket.on("room:state", roomSync);
            socket.on("system:error", ()=>{busy = false; clearTimeout(busyTimer); render();});
            socket.on("disconnect", ()=>{busy = false; clearTimeout(busyTimer); render();});
            socket.on("connect", render);
        }
        if (typeof currentRoomState !== "undefined") roomSync(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "colt_express") window.renderColtExpressGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once:true}); else sync();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initColtExpressHelpExplain, {once:true}); else initColtExpressHelpExplain();
})();
