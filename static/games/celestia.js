(() => {
    "use strict";

    const byId = suffix => document.getElementById(`celestia${suffix}`);
    const panel = byId("Panel");
    let view = null;
    let selectedCardId = null;
    let selectedTarget = null;
    let selectedDice = [];
    let suppressClickUntil = 0;
    let tooltipTimer = null;
    let modalReturnFocus = null;
    let selectionContext = null;

    const hazards = {
        cloud: ["☁️", "Cloud", "compass"],
        lightning: ["⚡", "Lightning", "lightning_rod"],
        bird: ["🐦", "Bird", "foghorn"],
        pirate: ["🏴‍☠️", "Pirate", "cannon"],
        blank: ["⬜", "Blank", null],
    };
    const cards = {
        compass: ["🧭", "Compass", "Covers Cloud (☁️)", "Equipment: covers one Cloud (☁️) die."],
        lightning_rod: ["⚡", "Lightning Arrester", "Covers Lightning (⚡)", "Equipment: covers one Lightning (⚡) die."],
        foghorn: ["📯", "Foghorn", "Covers Bird (🐦)", "Equipment: covers one Bird (🐦) die."],
        cannon: ["💣", "Cannon", "Covers Pirate (🏴‍☠️)", "Equipment: covers one Pirate (🏴‍☠️) die."],
        turbo: ["🛠️", "Turbo", "Covers any hazard", "Covers one hazard of any type when matching equipment is missing. You may save it and let the airship crash instead."],
        alternative_route: ["🗺️", "Alternative Route", "Reroll chosen dice", "During the reroll window, the captain selects one or more dice and plays this card to reroll them."],
        wind_gust: ["🌪️", "Wind Gust", "Reroll blank dice", "During the reroll window, any player aboard may play this to reroll every Blank (⬜) die."],
        ejection: ["🪂", "Ejection", "Send a passenger ashore", "During the ejection window, choose a passenger aboard, including yourself, but never the captain. They leave and collect current-city treasure (💎)."],
        jetpack: ["🎒", "Jetpack", "Collect treasure after a crash", "After a crash, spend this card to collect treasure (💎) from the current city, or skip to save it."],
    };
    const phaseLabels = {
        roll: "Takeoff", reroll_window: "Reroll window", passenger_choice: "Passenger decision",
        ejection_window: "Ejection window", captain_action: "Captain's turn", jetpack_window: "Airship crashed",
        journey_end: "Journey complete", game_over: "Game over",
    };
    const explanations = {
        RollBtn: ["Roll dice (🎲)", "The captain rolls the required dice for the next city to reveal its hazards."],
        StayBtn: ["Stay aboard", "Continue toward the next city. You receive no treasure if the airship crashes unless you use a Jetpack (🎒)."],
        LeaveBtn: ["Take treasure (💎)", "Leave the airship and collect treasure from the current city. If you are the only player aboard, this ends the journey safely."],
        PassSpecialBtn: ["Continue", "Pass this power-card window. The game continues once all eligible players pass; playing a power card resets those passes."],
        ResolveCardsBtn: ["Use equipment", "Automatically spend matching equipment for each hazard, then Turbo (🛠️) for any missing matches. No hand-card selection is needed."],
        ResolveTelescopeBtn: ["Magic Spyglass (🔭)", "Spend a Magic Spyglass treasure to resolve all hazards. This is only available when matching equipment alone cannot cover the dice; it can save your Turbo (🛠️)."],
        CrashBtn: ["Airship crashes", "Declare a crash when matching equipment alone is insufficient. You may save Turbo (🛠️) or Magic Spyglass (🔭). Players still aboard only receive treasure if they use Jetpack (🎒)."],
        JetpackUseBtn: ["Use Jetpack (🎒)", "Spend one Jetpack after the crash and collect treasure (💎) from the current city."],
        JetpackSkipBtn: ["Skip Jetpack (🎒)", "Save your Jetpack. You collect no treasure from this crash."],
        PlayPowerBtn: ["Play power card", "Play the selected card. Alternative Route (🗺️) requires selected dice; Ejection (🪂) requires a passenger aboard."],
        NextJourneyBtn: ["Next journey", "Confirm that you have reviewed the summary. The next journey begins only after every player is ready."],
        PlayAgainBtn: ["Play again", "Start a new game after the final result."],
    };
    const CELESTIA_EXPLAIN = {
        roll: { zh: "掷骰(🎲)：船长为下一座城市掷出所需骰子，揭示它的危险。", en: explanations.RollBtn[1] },
        stay: { zh: "留在船上：继续飞往下一座城市。飞艇坠毁时除非使用喷射背包(🎒)，否则得不到宝物。", en: explanations.StayBtn[1] },
        leave: { zh: "拿取宝物(💎)：离开飞艇并收取当前城市的宝物。如果你是船上唯一的玩家，这就安全地结束了本段旅程。", en: explanations.LeaveBtn[1] },
        pass_special: { zh: "继续：跳过这个功能牌窗口。所有有资格的玩家都跳过之后游戏继续，打出功能牌会重置这些跳过。", en: explanations.PassSpecialBtn[1] },
        resolve_cards: { zh: "使用装备：为每个危险自动花掉对应的装备，再用涡轮(🛠️)补上缺少的匹配。不需要手动选手牌。", en: explanations.ResolveCardsBtn[1] },
        resolve_telescope: { zh: "魔法望远镜(🔭)：花掉一个魔法望远镜宝物来解决全部危险。只有在仅靠装备无法覆盖骰子时才可用，它可以保住你的涡轮(🛠️)。", en: explanations.ResolveTelescopeBtn[1] },
        crash: { zh: "飞艇坠毁：当仅靠装备不足以应对时宣告坠毁。你可以保住涡轮(🛠️)或魔法望远镜(🔭)，仍在船上的玩家只有使用喷射背包(🎒)才能拿到宝物。", en: explanations.CrashBtn[1] },
        jetpack_use: { zh: "使用喷射背包(🎒)：坠毁后花掉一个喷射背包，收取当前城市的宝物(💎)。", en: explanations.JetpackUseBtn[1] },
        jetpack_skip: { zh: "跳过喷射背包(🎒)：保住你的喷射背包，这次坠毁不收取任何宝物。", en: explanations.JetpackSkipBtn[1] },
        play_power: { zh: "打出功能牌：打出选中的牌。备选航线(🗺️)需要选中骰子，弹射(🪂)需要船上一名乘客。", en: explanations.PlayPowerBtn[1] },
        next_journey: { zh: "下一段旅程：确认你已看过结算。所有玩家都准备好之后下一段旅程才开始。", en: explanations.NextJourneyBtn[1] },
        play_again: { zh: "再玩一次：最终结果出来之后开始新的一局。", en: explanations.PlayAgainBtn[1] },
        city: { zh: "城市：飞艇当前所在或即将前往的城市。牌上显示剩余宝物(💎)数量和要掷的骰子(🎲)数。抵达第 9 座城市时，仍在船上的所有人都能获得宝物。", en: "City: where the airship is now or where it is heading next. The tile shows how many treasure cards (💎) remain and how many dice (🎲) are rolled there. Reaching City 9 awards treasure to everyone still aboard." },
        die: { zh: "危险骰(🎲)：每种危险需要一张对应的装备来覆盖。空白(⬜)不产生危险。", en: "Hazard die (🎲): each hazard needs one matching equipment card to cover it, and a Blank (⬜) creates no hazard." },
        equipment: { zh: "装备牌：每张装备覆盖一个对应的危险骰。涡轮(🛠️)可以当作任意类型使用一次。", en: "Equipment card: each one covers a single matching hazard die, and Turbo (🛠️) can stand in for any type once." },
        treasure: { zh: "宝物(💎)：收集自城市的分数牌。魔法望远镜(🔭)可以解决全部危险。", en: "Treasure (💎): a scoring card collected from a city, and a Magic Spyglass (🔭) can resolve every hazard." },
        player: { zh: "玩家席位：显示是否在船上、是否为船长(🧭)、手牌(🃏)数量和宝物(💎)数量。", en: "Player seat: shows whether they are aboard, whether they are the captain (🧭), their hand size (🃏) and their treasure count (💎)." },
        detail: { zh: "这是一个说明标记，指向界面上的一个数值或图例。鼠标悬停或轻点可以查看它此刻的具体含义。", en: "This is an information marker pointing at a figure or a legend on the board. Hover or tap it to see what that element means right now." },
        dialog_close: { zh: "关闭当前对话框并回到飞艇。", en: "Close the current dialog and return to the airship." }
    };

    const CELESTIA_BUTTON_KEYS = {
        RollBtn: "roll", StayBtn: "stay", LeaveBtn: "leave", PassSpecialBtn: "pass_special",
        ResolveCardsBtn: "resolve_cards", ResolveTelescopeBtn: "resolve_telescope", CrashBtn: "crash",
        JetpackUseBtn: "jetpack_use", JetpackSkipBtn: "jetpack_skip", PlayPowerBtn: "play_power",
        NextJourneyBtn: "next_journey", PlayAgainBtn: "play_again",
    };

    const CELESTIA_HELP_CONFIG = {
        gameId: "celestia",
        title: { zh: "云端飞行 · Celestia", en: "Celestia" },
        basic: {
            win: {
                zh: "穿越九座城市收集宝物(💎)。一段旅程结束时达到目标分数即结束游戏，分数最高者获胜，平分时宝物牌较少者优先。",
                en: "Travel through nine cities and collect Treasures (💎). Reaching the target score at the end of a journey ends the game, the highest score wins, and ties favour the player with fewer treasure cards."
            },
            turn: {
                zh: "船长(🧭)为下一座城市掷骰(🎲)揭示危险，乘客依次决定留在船上还是拿当前城市的宝物(💎)下船，船长最后用装备、涡轮(🛠️)或魔法望远镜(🔭)解决危险。",
                en: "The captain (🧭) rolls dice (🎲) for the next city to reveal its hazards, passengers then decide in order whether to stay aboard or take the current city's treasure (💎), and the captain finally resolves the hazards with equipment, Turbo (🛠️) or a Magic Spyglass (🔭)."
            },
            key: {
                zh: "每一轮都有人要先下船，而留在船上的人才拿得到下一座城的宝物，所以真正的判断是你愿意为眼前这座城放弃后面多少。",
                en: "Every round someone must get off, and only those who stay aboard reach the next city's treasure, so the real judgement is how much you give up later for the city in front of you."
            }
        },
        sections: [
            {
                id: "goal",
                label: { zh: "云端之上的宝物", en: "Treasures above the clouds" },
                html: {
                    zh: "<p>穿越九座城市收集宝物(💎)。一段旅程结束时达到目标分数即结束游戏，分数最高者获胜，平分时宝物牌较少者优先。</p>",
                    en: "<p>Travel through nine cities and collect Treasures (💎). Reaching the target score at the end of a journey ends the game, the highest score wins, and ties favour the player with fewer treasure cards.</p>"
                }
            },
            {
                id: "flight",
                label: { zh: "一次飞行的步骤", en: "A flight, step by step" },
                html: {
                    zh: "<ol><li>船长(🧭)为下一座城市掷骰(🎲)，空白(⬜)不产生危险。</li><li>玩家可以使用备选航线(🗺️)或阵风(🌪️)，然后乘客依次决定：留在船上或拿当前城市的宝物(💎)。</li><li>玩家可以使用弹射(🪂)。随后船长用装备、涡轮(🛠️)或魔法望远镜(🔭)解决危险。</li><li>飞行成功就抵达下一座城市，并把船长身份传给船上的下一位玩家。坠毁则结束这段旅程，使用喷射背包(🎒)的人仍能拿到宝物。</li></ol>",
                    en: "<ol><li>The Captain (🧭) rolls Dice (🎲) for the next city, and a Blank (⬜) creates no hazard.</li><li>Players may use Alternative Route (🗺️) or Wind Gust (🌪️), then passengers decide in order whether to stay aboard or take current-city treasure (💎).</li><li>Players may use Ejection (🪂), and the captain then resolves hazards with equipment, Turbo (🛠️) or Magic Spyglass (🔭).</li><li>A successful flight reaches the next city and passes the captain's role to the next player aboard, while a crash ends the journey and Jetpack (🎒) users can still take treasure.</li></ol>"
                }
            },
            {
                id: "equipment",
                label: { zh: "装备与危险", en: "Equipment and hazards" },
                html: {
                    zh: "<p>罗盘(🧭)覆盖云(☁️)，避雷针(⚡)覆盖闪电(⚡)，雾号(📯)覆盖飞鸟(🐦)，加农炮(💣)覆盖海盗(🏴‍☠️)。每张牌覆盖一个对应的骰子。</p><p>使用装备会自动花掉对应的牌，再用涡轮(🛠️)补上缺少的匹配。如果仅靠装备不够，你可以改用魔法望远镜(🔭)，或者让飞艇坠毁以保住特殊牌。</p>",
                    en: "<p>Compass (🧭) covers Cloud (☁️), Lightning Arrester (⚡) covers Lightning (⚡), Foghorn (📯) covers Bird (🐦), and Cannon (💣) covers Pirate (🏴‍☠️). Each card covers one matching die.</p><p>Use equipment automatically spends matching cards and then Turbo (🛠️) for missing matches. If matching equipment alone is insufficient you may instead spend a Magic Spyglass (🔭), or let the airship crash to save your special cards.</p>"
                }
            },
            {
                id: "power",
                label: { zh: "功能牌", en: "Power cards" },
                html: {
                    zh: "<p>备选航线(🗺️)：船长选择骰子重掷。阵风(🌪️)：重掷全部空白(⬜)骰子。弹射(🪂)：选择船上一名乘客，包括你自己但绝不能是船长，把他连同宝物送上岸。喷射背包(🎒)：坠毁后收取宝物。</p>",
                    en: "<p>Alternative Route (🗺️): the captain selects dice to reroll. Wind Gust (🌪️): reroll all Blank (⬜) dice. Ejection (🪂): select a passenger aboard, including yourself but never the captain, to send ashore with treasure. Jetpack (🎒): collect treasure after a crash.</p>"
                }
            },
            {
                id: "journeys",
                label: { zh: "旅程与操作", en: "Journeys and controls" },
                html: {
                    zh: "<p>船上最后一名玩家可以选择拿宝物而不掷骰。抵达第 9 座城市时，仍在船上的所有人都能获得宝物。看完旅程结算后选择下一段旅程，所有人准备好之后游戏才继续。</p><p>相同的手牌会合并成一块并显示数量，只有可打出的功能牌才能被选中。选中一张牌，按需要选择骰子或乘客，再在手牌下方确认。再次点击该牌、点击空白处或按 Esc 可以取消选择。</p><p>鼠标悬停可以看简短提示，手机轻点显示三秒提示。先点 Explain 再点某个元素或按钮可以看到更详细的说明，包括已禁用的按钮。按 Esc 退出 Explain 或关闭对话框。</p>",
                    en: "<p>The last player aboard can take treasure instead of rolling. Reaching City 9 awards treasure to everyone still aboard. Review the journey summary and select Next journey, and everyone must be ready before the game continues.</p><p>Identical hand cards share one tile with a quantity, and only playable power cards can be selected. Select a card, choose any required dice or passenger, then confirm below your hand. Click the card again, click empty space, or press Esc to cancel the selection.</p><p>Hover over information for a short tooltip, and on a phone tap it for a three-second tooltip. Select Explain and then an item or button for more detail, including disabled buttons. Esc exits Explain or closes a dialog.</p>"
                }
            }
        ]
    };

    let celestiaHelpWidget = null;
    let celestiaExplainWidget = null;

    function initCelestiaHelpExplain() {
        if (celestiaHelpWidget || typeof window.obgCreateHelp !== "function") return;
        celestiaHelpWidget = window.obgCreateHelp(CELESTIA_HELP_CONFIG);
        celestiaExplainWidget = window.obgCreateExplain({
            gameId: "celestia",
            attribute: "data-celestia-explain",
            explanations: CELESTIA_EXPLAIN,
            button: byId("ExplainBtn"),
            root: () => panel,
            bypass: ["#celestiaHelpBtn", "#celestiaExplainBtn", "#celestiaHelpModalCloseBtn", "#celestiaExplainModalCloseBtn"]
        });
        byId("HelpBtn")?.addEventListener("click", () => {
            celestiaExplainWidget?.exit();
            celestiaHelpWidget.open();
        });
        byId("ExplainBtn")?.addEventListener("click", () => celestiaExplainWidget?.toggle());
    }

    function text(suffix, value) {
        byId(suffix).textContent = value;
    }
    function element(tag, className, value) {
        const node = document.createElement(tag);
        node.className = className;
        if (value != null) node.textContent = value;
        return node;
    }
    function name(id) {
        return view?.players?.find(player => player.player_id === id)?.name || id || "—";
    }
    function has(action) {
        if (!view?.legal_actions?.includes(action)) return false;
        // The public action list can still include special actions after passing.
        return !(["play_power", "pass_special"].includes(action) && view.special_passes?.includes(view.you));
    }
    function selectedCard() {
        return view?.your_hand?.find(card => card.id === selectedCardId);
    }
    function powerPlayable(card) {
        if (!card || !has("play_power")) return false;
        if (view.phase === "reroll_window") {
            return (card.kind === "alternative_route" && view.you === view.captain)
                || (card.kind === "wind_gust" && view.dice_results?.includes("blank"));
        }
        return view.phase === "ejection_window" && card.kind === "ejection"
            && view.players.some(player => player.on_ship && player.player_id !== view.captain);
    }
    function targetable(player) {
        return selectedCard()?.kind === "ejection" && powerPlayable(selectedCard())
            && player.on_ship && player.player_id !== view.captain;
    }
    function powerReady() {
        const card = selectedCard();
        if (!powerPlayable(card)) return false;
        if (card.kind === "alternative_route") return selectedDice.length > 0;
        if (card.kind === "ejection") return view.players.some(player => player.player_id === selectedTarget && targetable(player));
        return true;
    }
    function resolution() {
        const counts = {};
        for (const card of view?.your_hand || []) counts[card.kind] = (counts[card.kind] || 0) + 1;
        let missing = 0;
        for (const [hazard, info] of Object.entries(hazards)) {
            if (info[2]) missing += Math.max(0, (view?.hazard_counts?.[hazard] || 0) - (counts[info[2]] || 0));
        }
        return {
            cards: has("captain_resolve") && missing <= (counts.turbo || 0),
            spyglass: has("captain_resolve") && missing > 0 && view.your_treasures?.some(card => card.kind === "telescope"),
        };
    }
    function describe(node, title, description, tooltip = description, key = "detail") {
        node.dataset.celestiaExplainTitle = title;
        node.dataset.celestiaExplainText = description;
        if (tooltip) node.dataset.celestiaTooltip = tooltip;
        if (node.tagName !== "BUTTON") node.tabIndex = 0;
        return node;
    }
    function renderRoute() {
        const route = byId("Route");
        route.replaceChildren();
        for (let city = 1; city <= 9; city += 1) {
            const current = city === view.current_city;
            const next = city === view.next_city;
            const dice = city <= 4 ? 2 : city <= 7 ? 3 : 4;
            const count = view.treasure_counts?.[String(city)] ?? "—";
            const tile = element("div", `celestia-city${current ? " current" : next ? " next" : ""}`);
            if (current) tile.setAttribute("aria-current", "step");
            tile.append(element("span", "celestia-city-name", String(city)));
            tile.append(element("span", "celestia-city-meta", current ? "Aboard" : next ? "Next" : `${dice}🎲`));
            describe(tile, `City ${city}`, `${current ? "The airship is here. " : next ? "Your next destination. " : ""}${count} treasure cards (💎) remain. ${dice} dice (🎲) are rolled when approaching this city.`);
            route.append(tile);
        }
    }
    function renderDice() {
        const container = byId("Dice");
        container.replaceChildren();
        const canSelect = selectedCard()?.kind === "alternative_route" && powerPlayable(selectedCard());
        if (!view.dice_results?.length) {
            container.append(element("div", "celestia-empty", `${view.required_dice || 2} dice ready for takeoff`));
            return;
        }
        view.dice_results.forEach((face, index) => {
            const [icon, label, equipment] = hazards[face] || ["?", face, null];
            const die = element(canSelect ? "button" : "div", `celestia-die${selectedDice.includes(index) ? " selected" : ""}`);
            die.dataset.celestiaDie = String(index);
            die.append(element("span", "celestia-die-icon", icon), element("span", "celestia-die-name", label));
            describe(die, `${label} (${icon})`, equipment
                ? `Cover this hazard with ${cards[equipment][1]} (${cards[equipment][0]}) or Turbo (🛠️).`
                : "Blank (⬜) dice create no hazard and require no equipment.");
            if (canSelect) {
                die.type = "button";
                die.setAttribute("aria-label", `${label} die ${index + 1}: select to reroll`);
                die.setAttribute("aria-pressed", String(selectedDice.includes(index)));
                die.addEventListener("click", () => {
                    selectedDice = selectedDice.includes(index) ? selectedDice.filter(value => value !== index) : [...selectedDice, index];
                    // Keep the same nodes and focus while selecting multiple dice.
                    container.querySelectorAll("[data-celestia-die]").forEach(node => {
                        const selected = selectedDice.includes(Number(node.dataset.celestiaDie));
                        node.classList.toggle("selected", selected);
                        node.setAttribute("aria-pressed", String(selected));
                    });
                    renderSelection();
                });
            }
            container.append(die);
        });
    }
    function renderHand() {
        const container = byId("Hand");
        container.replaceChildren();
        const hand = view.your_hand || [];
        text("HandCount", `${hand.length} cards`);
        const groups = new Map();
        for (const card of hand) {
            if (!groups.has(card.kind)) groups.set(card.kind, []);
            groups.get(card.kind).push(card);
        }
        if (!hand.length) container.append(element("div", "celestia-empty", "No cards in hand"));
        for (const kind of Object.keys(cards)) {
            const group = groups.get(kind);
            if (!group) continue;
            const card = group.find(item => item.id === selectedCardId) || group[0];
            const [icon, title, caption, explanation] = cards[kind];
            const playable = powerPlayable(card);
            const node = element(playable ? "button" : "div", `celestia-card ${card.category || kind}${playable ? " playable" : ""}${card.id === selectedCardId ? " selected" : ""}`);
            node.dataset.celestiaKind = kind;
            node.append(element("span", "celestia-card-icon", icon), element("span", "celestia-card-count", `×${group.length}`),
                element("span", "celestia-card-title", title), element("span", "celestia-card-meta", caption));
            describe(node, `${title} (${icon})`, explanation, `${title} (${icon}) · ${group.length} in hand. ${explanation}`);
            if (playable) {
                node.type = "button";
                node.setAttribute("aria-pressed", String(card.id === selectedCardId));
                node.addEventListener("click", () => {
                    selectedCardId = selectedCardId === card.id ? null : card.id;
                    selectedDice = [];
                    selectedTarget = null;
                    hideTooltip();
                    renderHand();
                    renderDice();
                    renderPlayers();
                    renderSelection();
                    byId("Hand").querySelector(`[data-celestia-kind="${kind}"]`)?.focus({preventScroll: true});
                });
            }
            container.append(node);
        }
    }
    function renderTreasures() {
        const container = byId("Treasures");
        container.replaceChildren();
        const treasures = view.your_treasures || [];
        const spyglasses = treasures.filter(card => card.kind === "telescope").length;
        text("TreasureCount", `${treasures.length}${spyglasses ? ` · 🔭 ${spyglasses}` : ""}`);
        if (!treasures.length) container.append(element("div", "celestia-empty", "No treasures collected yet"));
        for (const card of treasures) {
            const spyglass = card.kind === "telescope";
            const title = spyglass ? "Magic Spyglass (🔭)" : `Treasure (💎) · ${card.points || 0} points`;
            const node = element("div", "celestia-card treasure");
            node.append(element("span", "celestia-card-title", card.label || title), element("span", "celestia-card-meta", `City ${card.city ?? "—"}`));
            describe(node, title, spyglass ? explanations.ResolveTelescopeBtn[1] : `Worth ${card.points || 0} points. Collected at City ${card.city ?? "—"}.`);
            container.append(node);
        }
    }
    function renderPlayers() {
        const container = byId("Players");
        container.replaceChildren();
        for (const player of view.players || []) {
            const isYou = player.player_id === view.you;
            const active = view.phase === "passenger_choice" ? player.player_id === view.pending_passenger
                : ["roll", "captain_action"].includes(view.phase) && player.player_id === view.captain;
            const canTarget = targetable(player);
            const node = element(canTarget ? "button" : "div", `celestia-player${isYou ? " is-you" : ""}${active ? " is-active" : ""}${canTarget ? " playable" : ""}${player.player_id === selectedTarget ? " selected" : ""}`);
            node.dataset.celestiaPlayer = player.player_id;
            node.append(element("div", "celestia-player-name", `${player.name || player.player_id}${isYou ? " · You" : ""}`));
            const tags = [player.player_id === view.captain ? "Captain 🧭" : "Passenger", player.on_ship ? "Aboard" : "Ashore"];
            if (view.phase === "journey_end" && view.next_ready?.includes(player.player_id)) tags.push("Ready ✓");
            else if (view.special_phase && view.special_passes?.includes(player.player_id)) tags.push("Passed ✓");
            else if (active) tags.push("Deciding…");
            node.append(element("div", "celestia-player-status", tags.join(" · ")));
            const score = player.score_hidden ? "🔒" : player.score ?? 0;
            node.append(element("div", "celestia-player-meta", `🃏 ${player.hand_count ?? 0} · 💎 ${player.treasure_count ?? 0} · Score ${score}`));
            describe(node, player.name || player.player_id, `${tags.join(". ")}. Hand (🃏): ${player.hand_count ?? 0} cards. Treasures (💎): ${player.treasure_count ?? 0}. ${player.score_hidden ? "Their score is hidden (🔒) until game end." : `Score: ${score}.`}`);
            if (canTarget) {
                node.type = "button";
                node.setAttribute("aria-pressed", String(player.player_id === selectedTarget));
                node.addEventListener("click", () => {
                    selectedTarget = selectedTarget === player.player_id ? null : player.player_id;
                    container.querySelectorAll("button[data-celestia-player]").forEach(target => {
                        const selected = target.dataset.celestiaPlayer === selectedTarget;
                        target.classList.toggle("selected", selected);
                        target.setAttribute("aria-pressed", String(selected));
                    });
                    renderSelection();
                });
            }
            container.append(node);
        }
    }
    function renderSummary() {
        const summary = view.journey_summary;
        const visible = ["journey_end", "game_over"].includes(view.phase);
        byId("Summary").classList.toggle("hidden", !visible);
        byId("Summary").setAttribute("aria-hidden", String(!visible));
        byId("ReadyStatus").classList.toggle("hidden", view.phase !== "journey_end");
        byId("WinnerStatus").classList.toggle("hidden", !view.winner?.length);
        text("ReadyCount", `${view.next_ready?.length || 0}/${view.players?.length || 0}`);
        text("Winner", view.winner?.map(name).join(", ") || "—");
        if (!visible) return;
        const reasons = {crash: "Airship crashed", finish: "Reached the final city", solo_leave: "Last traveler landed safely", all_left: "All travelers landed"};
        text("SummaryBody", `${reasons[summary?.reason] || "Journey ended"} at City ${summary?.city ?? view.current_city}. Your score: ${view.your_score ?? 0} 💎.`);
        const rewards = byId("SummaryRewards");
        rewards.replaceChildren();
        for (const reward of summary?.rewards || []) {
            const own = reward.player_id === view.you;
            const item = element("div", `celestia-reward${own ? " is-you" : ""}`, `${own ? "You" : name(reward.player_id)} · ${reward.treasure?.label || "No treasure"}`);
            rewards.append(item);
        }
        if (!rewards.childElementCount) rewards.append(element("div", "celestia-empty", "No additional treasure awarded."));
    }
    function renderSelection() {
        const card = selectedCard();
        const visible = powerPlayable(card);
        byId("PowerPrompt").classList.toggle("hidden", !visible);
        byId("PlayPowerBtn").classList.toggle("hidden", !visible);
        byId("PlayPowerBtn").disabled = !powerReady();
        if (!visible) return;
        const title = cards[card.kind][1];
        let caption = `${title} selected`;
        if (card.kind === "alternative_route") caption = selectedDice.length ? `${selectedDice.length} dice selected for reroll` : "Choose dice above to reroll";
        if (card.kind === "ejection") caption = selectedTarget ? `Eject ${name(selectedTarget)}` : "Choose a passenger in Crew";
        text("Selection", caption);
        text("PlayPowerBtn", card.kind === "alternative_route" ? `Reroll${selectedDice.length ? ` ${selectedDice.length} dice` : " dice"}`
            : card.kind === "ejection" ? "Eject passenger" : "Play Wind Gust");
    }
    function renderActions() {
        const resolved = resolution();
        const states = {
            RollBtn: has("roll_dice"), StayBtn: has("passenger_choice"), LeaveBtn: has("passenger_choice") || has("solo_leave"),
            PassSpecialBtn: has("pass_special"), ResolveCardsBtn: resolved.cards, ResolveTelescopeBtn: resolved.spyglass,
            CrashBtn: has("captain_fail"), JetpackUseBtn: has("jetpack_decision"), JetpackSkipBtn: has("jetpack_decision"),
            NextJourneyBtn: has("next_journey"), PlayAgainBtn: has("play_again"),
        };
        for (const [id, visible] of Object.entries(states)) {
            const button = byId(id);
            button.classList.toggle("hidden", !visible);
            button.disabled = !visible;
        }
        byId("Actions").classList.toggle("hidden", !Object.values(states).some(Boolean));
        const yourTurn = Object.values(states).some(Boolean) || has("play_power");
        byId("Status").classList.toggle("is-your-turn", yourTurn);
        document.body.classList.toggle("celestia-needs-action", yourTurn && currentGameType === "celestia");
        text("ResolveCardsBtn", view?.dice_results?.every(face => face === "blank") ? "Continue flight →" : "Use equipment →");
        text("LeaveBtn", `Take City ${view?.current_city ?? ""} treasure`);
        renderStatus(yourTurn);
        renderSelection();
    }
    function renderStatus(yourTurn) {
        if (!view) return;
        const captain = name(view.captain);
        let title = "Waiting for the crew";
        let hint = "The journey will continue shortly.";
        switch (view.phase) {
            case "roll":
                title = has("roll_dice") ? "You are the captain" : `${captain} is preparing to roll`;
                hint = has("solo_leave") ? "Fly on, or land safely with the current city's treasure." : `Next stop: City ${view.next_city ?? "—"} · ${view.required_dice} dice`;
                break;
            case "passenger_choice":
                title = has("passenger_choice") ? "Stay aboard or take treasure?" : `${name(view.pending_passenger)} is deciding`;
                hint = has("passenger_choice") ? `Land at City ${view.current_city}, or risk the flight to City ${view.next_city}.` : `Captain: ${captain} · The hazards are shown below.`;
                break;
            case "reroll_window":
            case "ejection_window":
                title = yourTurn ? "Play a power card or continue" : "Waiting for power-card decisions";
                hint = yourTurn ? "Select a highlighted card in your hand to use it." : view.special_passes?.includes(view.you)
                    ? "You passed. Waiting for the remaining players." : "The crew can play a card before the flight continues.";
                if (view.special_passes?.length) hint += ` ${view.special_passes.length} passed.`;
                break;
            case "captain_action":
                title = yourTurn ? "Guide the airship through" : `${captain} is resolving the hazards`;
                hint = yourTurn ? resolution().cards ? "Matching equipment is used automatically." : resolution().spyglass
                    ? "Your spyglass can save the flight." : "Your cards cannot cover these hazards." : "Watch the dice and the crew's next move.";
                break;
            case "jetpack_window":
                title = has("jetpack_decision") ? "A last chance for treasure" : "Waiting for jetpack decisions";
                hint = has("jetpack_decision") ? `Use a Jetpack (🎒) to take City ${view.current_city} treasure.` : "The airship crashed. Travelers are deciding whether to use their Jetpacks (🎒).";
                break;
            case "journey_end":
                title = has("next_journey") ? "Ready for another journey?" : "You're ready ✓";
                hint = `${view.next_ready?.length || 0}/${view.players?.length || 0} ready · The next journey starts when everyone confirms.`;
                break;
            case "game_over":
                title = `🏆 ${view.winner?.map(name).join(", ") || "Journey complete"}`;
                hint = `Final score: ${view.your_score ?? 0} 💎`;
                break;
        }
        text("StatusTitle", title);
        text("StatusHint", hint);
    }
    function resetSelection() {
        selectedCardId = null;
        selectedDice = [];
        selectedTarget = null;
    }
    function cancelSelection() {
        if (!selectedCardId) return;
        resetSelection();
        renderHand();
        renderDice();
        renderPlayers();
        renderSelection();
    }
    function render(data) {
        const next = data.view || {};
        const context = JSON.stringify([data.room_id, next.journey_no, next.current_city, next.phase, next.captain, next.dice_results]);
        if (context !== selectionContext) resetSelection();
        selectionContext = context;
        view = next;
        if (!powerPlayable(selectedCard())) resetSelection();
        if (!view.players?.some(player => player.player_id === selectedTarget && targetable(player))) selectedTarget = null;
        if (currentGameType !== "celestia") {
            currentGameType = "celestia";
            setGamePanelVisibility("celestia");
        }
        hideTooltip();
        text("Phase", phaseLabels[view.phase] || "Preparing");
        text("Journey", view.journey_no ?? "—");
        text("Captain", name(view.captain));
        text("CurrentCity", view.current_city ?? "—");
        text("NextCity", view.next_city ?? "—");
        text("RequiredDice", view.required_dice ?? "—");
        text("YourScore", `${view.your_score ?? 0} / ${view.config?.target_score ?? 50}`);
        renderSummary();
        renderRoute();
        renderDice();
        renderHand();
        renderTreasures();
        renderPlayers();
        renderActions();
        logGameEvents(data);
    }
    function dispatch(action) {
        if (!has(action.type)) return;
        hideTooltip();
        sendAction(action);
    }
    const actions = {
        RollBtn: () => ({type: "roll_dice"}),
        StayBtn: () => ({type: "passenger_choice", choice: "stay"}),
        LeaveBtn: () => has("solo_leave") ? {type: "solo_leave"} : {type: "passenger_choice", choice: "leave"},
        PassSpecialBtn: () => ({type: "pass_special"}),
        ResolveCardsBtn: () => resolution().cards && ({type: "captain_resolve", method: "cards"}),
        ResolveTelescopeBtn: () => resolution().spyglass && ({type: "captain_resolve", method: "telescope", treasure_id: view.your_treasures.find(card => card.kind === "telescope").id}),
        CrashBtn: () => ({type: "captain_fail"}),
        JetpackUseBtn: () => ({type: "jetpack_decision", use: true}),
        JetpackSkipBtn: () => ({type: "jetpack_decision", use: false}),
        NextJourneyBtn: () => ({type: "next_journey"}),
        PlayAgainBtn: () => ({type: "play_again"}),
        PlayPowerBtn: () => {
            if (!powerReady()) return null;
            const action = {type: "play_power", card_id: selectedCardId};
            if (selectedCard().kind === "alternative_route") action.dice_indexes = [...selectedDice];
            if (selectedCard().kind === "ejection") action.target_player_id = selectedTarget;
            return action;
        },
    };
    for (const [id, getAction] of Object.entries(actions)) {
        describe(byId(id), ...explanations[id], undefined, CELESTIA_BUTTON_KEYS[id]);
        byId(id).addEventListener("click", () => {
            const action = getAction();
            if (action) dispatch(action);
        });
    }

    function hideTooltip() {
        clearTimeout(tooltipTimer);
        byId("Tooltip").hidden = true;
    }
    function showTooltip(target, temporary = false) {
        if (celestiaExplainWidget?.isActive() || celestiaHelpWidget?.isOpen() || !target?.dataset.celestiaTooltip) return;
        hideTooltip();
        const tooltip = byId("Tooltip");
        tooltip.textContent = target.dataset.celestiaTooltip;
        tooltip.hidden = false;
        const rect = target.getBoundingClientRect();
        const box = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - box.width - 8))}px`;
        tooltip.style.top = `${rect.bottom + box.height + 12 < innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - box.height - 6)}px`;
        if (temporary) tooltipTimer = setTimeout(hideTooltip, 3000);
    }
    function openModal(id) {
        hideTooltip();
        modalReturnFocus = document.activeElement;
        setModalVisible(byId(id), true);
        byId(`${id}CloseBtn`).focus();
    }
    function closeModal(id) {
        setModalVisible(byId(id), false);
        if (modalReturnFocus?.isConnected) modalReturnFocus.focus({preventScroll: true});
        modalReturnFocus = null;
    }
    panel.querySelectorAll("[data-celestia-tooltip]").forEach(node => {
        if (!node.dataset.celestiaExplain) describe(node, node.textContent.trim().replace(/\s+/g, " "), node.dataset.celestiaTooltip);
    });
    for (const id of ["HelpModal", "ExplainModal"]) {
        const modal = byId(id);
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", id === "HelpModal" ? "Celestia Help" : "Celestia Explain");
        byId(`${id}CloseBtn`).addEventListener("click", () => closeModal(id));
        modal.addEventListener("click", event => { if (event.target === modal) closeModal(id); });
    }
    document.addEventListener("click", event => {
        if (currentGameType !== "celestia") return;
        if (Date.now() < suppressClickUntil && !event.target.closest("#celestiaHelpModal, #celestiaExplainModal")) {
            suppressClickUntil = 0;
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
    panel.addEventListener("click", event => {
        const target = event.target.closest("[data-celestia-tooltip]");
        if (target && !target.matches("button")) showTooltip(target, true);
        else if (!event.target.closest("button, summary, a, input, [data-celestia-explain]")) {
            hideTooltip();
            cancelSelection();
        }
    });
    panel.addEventListener("pointerover", event => {
        if (event.pointerType === "mouse") showTooltip(event.target.closest("[data-celestia-tooltip]"));
    });
    panel.addEventListener("pointerout", event => {
        const target = event.target.closest("[data-celestia-tooltip]");
        if (target && !target.contains(event.relatedTarget)) hideTooltip();
    });
    panel.addEventListener("focusin", event => showTooltip(event.target.closest("[data-celestia-tooltip]")));
    panel.addEventListener("focusout", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
    document.addEventListener("keydown", event => {
        if (currentGameType !== "celestia") return;
        const modalId = ["ExplainModal", "HelpModal"].find(id => !byId(id).classList.contains("hidden"));
        if (event.key === "Escape") {
            if (modalId) closeModal(modalId);
            else if (celestiaExplainWidget?.isActive()) celestiaExplainWidget.exit();
            else cancelSelection();
            hideTooltip();
        } else if (event.key === "Tab" && modalId) {
            const focusable = [...byId(modalId).querySelectorAll("button, a[href], [tabindex='0']")];
            const first = focusable[0], last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        } else if (["Enter", " "].includes(event.key) && panel.contains(event.target) && !event.target.matches("button, summary")) {
            const target = event.target.closest("[data-celestia-explain]");
            if (target) { event.preventDefault(); showTooltip(target, true); }
        }
    });

    window.renderCelestiaGameState = render;
    window.showCelestiaHeaderActions = show => {
        byId("HeaderActions").style.display = show ? "flex" : "none";
        if (!show) {
            celestiaExplainWidget?.exit();
            hideTooltip();
            for (const id of ["HelpModal", "ExplainModal"]) setModalVisible(byId(id), false);
            document.body.classList.remove("celestia-needs-action");
        } else if (view) renderActions();
    };
    window.clearCelestiaState = () => {
        view = null;
        selectionContext = null;
        resetSelection();
        celestiaExplainWidget?.exit();
        for (const id of ["Route", "Dice", "Hand", "Treasures", "Players", "SummaryRewards"]) byId(id).replaceChildren();
        for (const id of ["Summary", "PowerPrompt"]) byId(id).classList.add("hidden");
        for (const id of Object.keys(actions)) byId(id).classList.add("hidden");
        byId("TreasuresDetails").open = false;
        document.body.classList.remove("celestia-needs-action");
    };
    initCelestiaHelpExplain();
})();
